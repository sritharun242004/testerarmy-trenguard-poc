import { execFile, spawn, type ChildProcess } from 'node:child_process';

interface ProcessExit {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error: string | null;
}

export interface CapturedProcess extends ProcessExit {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  cleanupError: string | null;
}

function appendOutput(previous: string, chunk: Buffer): string {
  const output = previous + chunk.toString();
  const limit = 1_048_576;
  const marker = '[Earlier output truncated]\n';
  return output.length > limit ? marker + output.slice(-(limit - marker.length)) : output;
}

// Own the real executable, its pipes, and (on POSIX) its process group. Package
// manager/tsx CLI wrappers can exit independently of the processes behind them.
export class BenchmarkProcess {
  readonly child: ChildProcess;
  readonly exited: AbortSignal;
  private readonly closed: Promise<ProcessExit>;
  private isClosed = false;
  private spawnError: string | null = null;
  stdout = '';
  stderr = '';

  constructor(command: string, args: string[], env: NodeJS.ProcessEnv) {
    const exitController = new AbortController();
    this.exited = exitController.signal;
    this.child = spawn(command, args, {
      cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    // Always drain both streams, including during startup and shutdown. Keep a
    // bounded diagnostic tail so a noisy child cannot exhaust the runner's heap.
    this.child.stdout?.on('data', (chunk: Buffer) => { this.stdout = appendOutput(this.stdout, chunk); });
    this.child.stderr?.on('data', (chunk: Buffer) => { this.stderr = appendOutput(this.stderr, chunk); });
    this.child.once('error', (error) => {
      this.spawnError = error.message;
      exitController.abort(error);
    });
    this.child.once('exit', (code, signal) => {
      exitController.abort(new Error(`Child exited (code ${code}, signal ${signal}).`));
    });
    this.closed = new Promise((resolve) => {
      this.child.once('close', (exitCode, signal) => {
        this.isClosed = true;
        resolve({ exitCode, signal, error: this.spawnError });
      });
    });
  }

  async capture(timeoutMs: number, shutdownMs: number, signal: AbortSignal): Promise<CapturedProcess> {
    const completed = await this.waitForClose(timeoutMs, signal);
    const cancelled = signal.aborted;
    let cleanupError: string | null = null;
    try {
      await this.stop(shutdownMs);
    } catch (error: unknown) {
      cleanupError = error instanceof Error ? error.message : String(error);
    }
    return {
      exitCode: this.child.exitCode,
      signal: this.child.signalCode,
      error: this.spawnError,
      stdout: this.stdout,
      stderr: this.stderr,
      timedOut: !completed && !cancelled,
      cancelled,
      cleanupError,
    };
  }

  async stop(shutdownMs: number): Promise<void> {
    try {
      // Still attempt the force-kill if the graceful signal could not be sent.
      await this.signal('SIGTERM', shutdownMs).catch(() => {});
      const closed = await this.waitForClose(shutdownMs);
      // Even a closed leader may have left descendants behind. Signal the owned
      // group, not just child.pid, and await pipe closure after forced shutdown.
      await this.signal('SIGKILL', shutdownMs);
      if (!closed && !await this.waitForClose(shutdownMs)) {
        throw new Error(`Child cleanup timed out after SIGKILL (${shutdownMs}ms).`);
      }
    } finally {
      if (!this.isClosed) {
        // A failed kill must be reported, but must not pin the parent event loop.
        this.child.stdout?.destroy();
        this.child.stderr?.destroy();
        this.child.unref();
      }
    }
  }

  private async signal(signal: 'SIGTERM' | 'SIGKILL', timeoutMs: number): Promise<void> {
    const pid = this.child.pid;
    if (!pid) return; // Spawn failure: no process to signal.
    if (process.platform === 'win32') {
      if (this.isClosed) return;
      if (signal === 'SIGTERM') {
        this.child.kill(signal);
      } else {
        await new Promise<void>((resolve, reject) => {
          execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: timeoutMs }, (error) => {
            if (error && !this.isClosed) reject(error);
            else resolve();
          });
        });
      }
      return;
    }
    try {
      process.kill(-pid, signal);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }

  private async waitForClose(timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    if (this.isClosed) return true;
    if (signal?.aborted) return false;
    let timer: NodeJS.Timeout | undefined;
    let abort: (() => void) | undefined;
    try {
      return await Promise.race([
        this.closed.then(() => true),
        new Promise<boolean>((resolve) => {
          abort = () => resolve(false);
          timer = setTimeout(abort, timeoutMs);
          signal?.addEventListener('abort', abort, { once: true });
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (abort) signal?.removeEventListener('abort', abort);
    }
  }
}
