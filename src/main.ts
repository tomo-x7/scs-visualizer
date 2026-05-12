import "./style.css";
import { ScsMachine } from "./scs-machine";
import { createOutputRenderer, resetOutput, type OutputBindings, type OutputRenderer } from "./ui/output";
import { clamp } from "./util";

type DomRefs = {
	programInput: HTMLTextAreaElement;
	lineNumberInput: HTMLTextAreaElement;
	runButton: HTMLButtonElement;
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
});

dom.stepButton.addEventListener("click", () => {
	if (!activeMachine || !activeRenderer || !activeMachine.running) return;
	try {
		const res = activeMachine.step();
		activeRenderer.update(activeMachine.getOutput(), activeMachine.getRegisters());
		activeRenderer.highlight(res);
	} catch (e) {
		window.alert(e instanceof Error ? e.message : String(e));
		stopAndReset();
	}
});

dom.runButton.addEventListener("click", async () => {
	manualReset = false;
	resetOutput(outputBindings);
	setUiRunning();
	const selectedSpeed = speedIndex;
	const machine = new ScsMachine(dom.programInput.value);
	activeMachine = machine;
	const onStop = () => {
		if (activeMachine !== machine) return;
		setUiIdle();
	};
	machine.onStop = onStop;
	const renderer = createOutputRenderer(outputBindings, machine.lineCount);
	activeRenderer = renderer;
	const updateOutput = () => renderer.update(machine.getOutput(), machine.getRegisters());
	try {
		machine.compile();
		machine.running = true;
		if (selectedSpeed === 0) {
			updateOutput();
			dom.stepButton.disabled = false;
		} else {
			while (machine.running) {
				const res = machine.step();
				// if (machine.stepCount > 1000) throw new Error("Too many steps, possible infinite loop");
				if (selectedSpeed === 5) {
					if (machine.stepCount % 10000 === 0) {
						updateOutput();
						await new Promise((resolve) => setTimeout(resolve, 0));
					}
				} else {
					updateOutput();
					renderer.highlight(res);
					await new Promise((resolve) => setTimeout(resolve, speedDelaysMs[selectedSpeed]));
				}
			}
			if (!manualReset) {
				updateOutput();
			}
			onStop();
		}
	} catch (e) {
		window.alert(e instanceof Error ? e.message : String(e));
		stopAndReset();
	} finally {
		if (selectedSpeed !== 0 && activeMachine === machine) {
			activeMachine = null;
			activeRenderer = null;
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

function setCodeVisibility(visible: boolean) {
	document.body.classList.toggle("nocode", !visible);
}

function setUiRunning() {
	dom.runButton.disabled = true;
	dom.stepButton.disabled = true;
	dom.speedInput.disabled = true;
}

function setUiIdle() {
	dom.runButton.disabled = false;
	dom.stepButton.disabled = true;
	dom.speedInput.disabled = false;
}

function stopAndReset() {
	manualReset = true;
	if (activeMachine) {
		activeMachine.running = false;
	}
	activeMachine = null;
	activeRenderer = null;
	resetOutput(outputBindings);
	setUiIdle();
}

function formatSpeedLabel(value: number, speedDelaysMs: number[]) {
	if (value === 0) return "ステップ実行";
	if (value === 5) return "最速";
	return `${speedDelaysMs[value]}ms/step`;
}
