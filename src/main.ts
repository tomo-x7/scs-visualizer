import "./style.css";
import { ScsMachine } from "./scs-machine";
import { createOutputRenderer, type OutputBindings, type OutputRenderer, resetOutput } from "./ui/output";
import { clamp } from "./util";

type DomRefs = {
	programInput: HTMLTextAreaElement;
	lineNumberInput: HTMLTextAreaElement;
	runButton: HTMLButtonElement;
	pauseButton: HTMLButtonElement;
	stepButton: HTMLButtonElement;
	stopButton: HTMLButtonElement;
	speedInput: HTMLInputElement;
	speedLabel: HTMLDivElement;
	hideCodeButton: HTMLButtonElement;
	showCodeButton: HTMLButtonElement;
};

const dom = getDomRefs();
const outputBindings: OutputBindings = {
	output: document.querySelector<HTMLDivElement>("#memories")!,
	stepsOutput: document.querySelector<HTMLDivElement>("#steps>.value")!,
	pcOutput: document.querySelector<HTMLDivElement>("#pc>.value")!,
	accOutput: document.querySelector<HTMLDivElement>("#acc>.value")!,
	idxOutput: document.querySelector<HTMLDivElement>("#idx>.value")!,
};

resetOutput(outputBindings);

const speedDelaysMs = [0, 1000, 500, 100, 50, 0];
let speedIndex = Number(dom.speedInput.value);
speedIndex = clamp(0, speedIndex, speedDelaysMs.length - 1);
updateSpeedLabel();

let lineCount = initializeLineNumbers(dom.programInput, dom.lineNumberInput);
syncLineNumberWidth(dom.lineNumberInput);
resizeEditorContent(dom.programInput, dom.lineNumberInput);

let activeMachine: ScsMachine | null = null;
let activeRenderer: OutputRenderer | null = null;
let manualReset = false;
let isPaused = false;
let resumeWaiters: Array<() => void> = [];

dom.hideCodeButton.addEventListener("click", () => setCodeVisibility(false));
dom.showCodeButton.addEventListener("click", () => setCodeVisibility(true));

dom.programInput.addEventListener("input", (ev) => {
	const target = ev.target as HTMLTextAreaElement;
	const nextCount = target.value.split("\n").length;
	if (lineCount !== nextCount) {
		lineCount = nextCount;
		updateLineNumbers(dom.lineNumberInput, nextCount);
		syncLineNumberWidth(dom.lineNumberInput);
	}
	resizeEditorContent(dom.programInput, dom.lineNumberInput);
});

dom.speedInput.addEventListener("input", (ev) => {
	const target = ev.target as HTMLInputElement;
	speedIndex = clamp(0, Number(target.value), speedDelaysMs.length - 1);
	updateSpeedLabel();
	if (activeMachine?.running) {
		if (speedIndex === 0 && !isPaused) {
			setPaused(true);
		} else {
			applyUiState();
		}
	}
});

dom.stepButton.addEventListener("click", () => {
	if (!activeMachine || !activeRenderer || !activeMachine.running || !isPaused) return;
	try {
		const res = activeMachine.step();
		activeRenderer.update(activeMachine.getOutput(), activeMachine.getRegisters());
		activeRenderer.highlight(res);
	} catch (e) {
		window.alert(e instanceof Error ? e.message : String(e));
		stopAndReset();
	}
});

dom.pauseButton.addEventListener("click", () => {
	if (!activeMachine?.running) return;
	if (speedIndex === 0) return;
	setPaused(!isPaused);
});

dom.runButton.addEventListener("click", async () => {
	manualReset = false;
	resetOutput(outputBindings);
	const machine = new ScsMachine(dom.programInput.value);
	activeMachine = machine;
	const onStop = () => handleMachineStop(machine);
	machine.onStop = onStop;
	const renderer = createOutputRenderer(outputBindings, machine.lineCount);
	activeRenderer = renderer;
	const updateOutput = () => renderer.update(machine.getOutput(), machine.getRegisters());
	try {
		machine.compile();
		machine.running = true;
		updateOutput();
		if (speedIndex === 0) {
			setPaused(true);
		} else {
			setPaused(false);
		}
		const { autoSteps, durationMs } = await runLoop(machine, renderer, updateOutput);
		if (autoSteps > 0) {
			console.log(`Execution finished in ${durationMs.toFixed(3)}ms, ${machine.stepCount} steps`);
		}
		if (!manualReset) {
			updateOutput();
		}
		onStop();
	} catch (e) {
		window.alert(e instanceof Error ? e.message : String(e));
		stopAndReset();
	} finally {
		if (activeMachine === machine) {
			activeMachine = null;
			activeRenderer = null;
			isPaused = false;
			applyUiState();
		}
		manualReset = false;
	}
});

dom.stopButton.addEventListener("click", () => {
	stopAndReset();
});

function getDomRefs(): DomRefs {
	return {
		programInput: document.querySelector<HTMLTextAreaElement>("#program")!,
		lineNumberInput: document.querySelector<HTMLTextAreaElement>("#linenum")!,
		runButton: document.querySelector<HTMLButtonElement>("#run")!,
		pauseButton: document.querySelector<HTMLButtonElement>("#pause")!,
		stepButton: document.querySelector<HTMLButtonElement>("#step")!,
		stopButton: document.querySelector<HTMLButtonElement>("#stop")!,
		speedInput: document.querySelector<HTMLInputElement>("#speed")!,
		speedLabel: document.querySelector<HTMLDivElement>("#speedlabel")!,
		hideCodeButton: document.querySelector<HTMLButtonElement>("#hide-code")!,
		showCodeButton: document.querySelector<HTMLButtonElement>("#show-code")!,
	};
}

function initializeLineNumbers(programInput: HTMLTextAreaElement, lineNumberInput: HTMLTextAreaElement) {
	const count = programInput.value.split("\n").length;
	updateLineNumbers(lineNumberInput, count);
	return count;
}

function updateLineNumbers(lineNumberInput: HTMLTextAreaElement, count: number) {
	lineNumberInput.value = Array.from({ length: count }, (_, i) => i).join("\n");
}

function syncLineNumberWidth(lineNumberInput: HTMLTextAreaElement) {
	lineNumberInput.style.width = "0px";
	lineNumberInput.style.width = `${Math.max(30, lineNumberInput.scrollWidth + 10)}px`;
}

function resizeEditorContent(programInput: HTMLTextAreaElement, lineNumberInput: HTMLTextAreaElement) {
	programInput.style.height = "0px";
	programInput.style.height = `${programInput.scrollHeight + 1}px`;
	lineNumberInput.style.height = programInput.style.height;
}

function updateSpeedLabel() {
	dom.speedLabel.textContent = formatSpeedLabel(speedIndex, speedDelaysMs);
}

function updatePauseButtonLabel() {
	dom.pauseButton.textContent = isPaused ? "Resume" : "Pause";
}

function setCodeVisibility(visible: boolean) {
	document.body.classList.toggle("nocode", !visible);
}

function setUiRunning() {
	dom.runButton.disabled = true;
	dom.stepButton.disabled = true;
	dom.pauseButton.disabled = speedIndex === 0;
	dom.speedInput.disabled = false;
	updatePauseButtonLabel();
}

function setUiIdle() {
	dom.runButton.disabled = false;
	dom.pauseButton.disabled = true;
	dom.stepButton.disabled = true;
	dom.speedInput.disabled = false;
	updatePauseButtonLabel();
}

function setUiPaused() {
	dom.runButton.disabled = true;
	dom.pauseButton.disabled = speedIndex === 0;
	dom.stepButton.disabled = false;
	dom.speedInput.disabled = false;
	updatePauseButtonLabel();
}

function applyUiState() {
	if (!activeMachine?.running) {
		setUiIdle();
		return;
	}
	if (isPaused) {
		setUiPaused();
		return;
	}
	setUiRunning();
}

function setPaused(paused: boolean) {
	if (isPaused === paused) {
		applyUiState();
		return;
	}
	isPaused = paused;
	applyUiState();
	if (!isPaused) {
		notifyResumeWaiters();
	}
}

function stopAndReset() {
	manualReset = true;
	if (activeMachine) {
		activeMachine.running = false;
	}
	isPaused = false;
	notifyResumeWaiters();
	activeMachine = null;
	activeRenderer = null;
	resetOutput(outputBindings);
	applyUiState();
}

function formatSpeedLabel(value: number, speedDelaysMs: number[]) {
	if (value === 0) return "ステップ実行";
	if (value === 5) return "最速";
	return `${speedDelaysMs[value]}ms/step`;
}

function handleMachineStop(machine: ScsMachine) {
	if (activeMachine !== machine) return;
	isPaused = false;
	notifyResumeWaiters();
	applyUiState();
}

function notifyResumeWaiters() {
	if (resumeWaiters.length === 0) return;
	const waiters = resumeWaiters;
	resumeWaiters = [];
	for (const resolve of waiters) {
		resolve();
	}
}

function waitForResume() {
	if (!activeMachine?.running) return Promise.resolve();
	if (!isPaused && speedIndex !== 0) return Promise.resolve();
	return new Promise<void>((resolve) => {
		resumeWaiters.push(resolve);
	});
}

async function runLoop(machine: ScsMachine, renderer: OutputRenderer, updateOutput: () => void) {
	const start = performance.now();
	let stepsSinceOutput = 0;
	let autoSteps = 0;
	while (machine.running) {
		await waitForResume();
		if (!machine.running) break;
		if (isPaused || speedIndex === 0) {
			continue;
		}
		const res = machine.step();
		autoSteps++;
		// if (machine.stepCount > 1000) throw new Error("Too many steps, possible infinite loop");
		if (speedIndex === 5) {
			stepsSinceOutput++;
			if (stepsSinceOutput >= 10000) {
				updateOutput();
				stepsSinceOutput = 0;
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		} else {
			stepsSinceOutput = 0;
			updateOutput();
			renderer.highlight(res);
			await new Promise((resolve) => setTimeout(resolve, speedDelaysMs[speedIndex]));
		}
	}
	return { autoSteps, durationMs: performance.now() - start };
}
