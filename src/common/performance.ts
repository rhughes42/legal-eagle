/**
 * A simple stopwatch utility for measuring elapsed time.
 * Provides methods to start, stop, reset, and lap time intervals.
 *
 * @example
 * ```typescript
 * import { Stopwatch } from 'src/common/performance';
 *
 * const sw = Stopwatch.startNew();
 * await doSomething();
 * const elapsed = sw.stop();
 * console.log(`Elapsed time: ${elapsed} ms`);
 * ```
 */

/**
 * Times the execution of a function.
 * @typeParam T - The function's return type.
 * @param fn - The function to execute and measure. Can be sync or async.
 * @returns A promise that resolves with the function result and the elapsed time in milliseconds.
 */
class Stopwatch {
	private _start: bigint | null = null
	private _elapsedNs: bigint = 0n

	/**
	 * Creates a new stopwatch and starts it immediately.
	 * @returns A started Stopwatch instance.
	 */
	static startNew(): Stopwatch {
		const sw = new Stopwatch()
		sw.start()
		return sw
	}

	/**
	 * Starts the stopwatch if it is not already running.
	 */
	start(): void {
		if (this._start !== null) return
		this._start = process.hrtime.bigint()
	}

	/**
	 * Stops the stopwatch and returns the total elapsed time in milliseconds.
	 * If the stopwatch is not running, returns the elapsed time accumulated so far.
	 * @returns Elapsed time in milliseconds.
	 */
	stop(): number {
		if (this._start !== null) {
			this._elapsedNs += process.hrtime.bigint() - this._start
			this._start = null
		}
		return this.elapsedMs
	}

	/**
	 * Clears the elapsed time and stops the stopwatch.
	 */
	reset(): void {
		this._start = null
		this._elapsedNs = 0n
	}

	/**
	 * Resets the stopwatch to zero and starts it.
	 */
	restart(): void {
		this.reset()
		this.start()
	}

	/**
	 * Measures the time since the last lap (or since start) and adds it to the total.
	 * If the stopwatch was not running, starts it and returns 0.
	 * @returns Lap duration in milliseconds.
	 */
	lap(): number {
		const now = process.hrtime.bigint()
		if (this._start === null) {
			this._start = now
			return 0
		}
		const delta = now - this._start
		this._elapsedNs += delta
		this._start = now
		return Number(delta) / 1e6
	}

	/**
	 * Whether the stopwatch is currently running.
	 */
	get isRunning(): boolean {
		return this._start !== null
	}

	/**
	 * The total elapsed time in milliseconds, including the current run if running.
	 */
	get elapsedMs(): number {
		const current = this._start ? process.hrtime.bigint() - this._start : 0n
		return Number(this._elapsedNs + current) / 1e6
	}

	/**
	 * The total elapsed time in seconds, derived from elapsed milliseconds.
	 */
	get elapsedSeconds(): number {
		return this.elapsedMs / 1000
	}

	/**
	 * Times the execution of a function.
	 * @typeParam T - The function's return type.
	 * @param fn - The function to execute and measure. Can be sync or async.
	 * @returns A promise that resolves with the function result and the elapsed time in milliseconds.
	 */
	static async time<T>(fn: () => Promise<T> | T): Promise<{ result: T; ms: number }> {
		const sw = Stopwatch.startNew()
		const result = await Promise.resolve(fn())
		const ms = sw.stop()
		return { result, ms }
	}
}

export { Stopwatch }
