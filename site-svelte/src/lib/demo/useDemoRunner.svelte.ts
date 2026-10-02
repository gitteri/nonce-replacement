export interface Step {
	label: string;
	detail?: string;
	link?: string;
	/** Short label for the flow-diagram box (e.g. "Initialize", "Advance") — set only on
	 * steps that represent an actual on-chain instruction landing. Steps without it (fetches,
	 * narrative-only commentary) don't get a diagram node. */
	node?: string;
}

export type DemoStatus = 'idle' | 'running' | 'done' | 'error';

export function errorMessage(err: unknown): string {
	// Browser wallet providers often reject with a plain `{code, message}` object
	// instead of throwing an Error (e.g. the user cancels the signature request) —
	// String() on that yields "[object Object]", losing the actual reason.
	let message: string;
	if (err instanceof Error) {
		message = err.message;
	} else if (
		typeof err === 'object' &&
		err !== null &&
		'message' in err &&
		typeof (err as { message: unknown }).message === 'string'
	) {
		message = (err as { message: string }).message;
	} else if (typeof err === 'object' && err !== null) {
		try {
			message = JSON.stringify(err);
		} catch {
			message = String(err);
		}
	} else {
		message = String(err);
	}
	return message.split('\n')[0];
}

export function useDemoRunner() {
	let status = $state<DemoStatus>('idle');
	let steps = $state<Step[]>([]);
	let error = $state<string | null>(null);

	async function run(fn: (addStep: (step: Step) => void) => Promise<void>) {
		status = 'running';
		steps = [];
		error = null;

		const addStep = (step: Step) => (steps = [...steps, step]);

		try {
			await fn(addStep);
			status = 'done';
		} catch (err) {
			error = errorMessage(err);
			status = 'error';
		}
	}

	return {
		get status() {
			return status;
		},
		get steps() {
			return steps;
		},
		get error() {
			return error;
		},
		run
	};
}
