import "./style.css";
import { ScsMachine } from "./scs-machine";
import { createOutputRenderer, resetOutput, type OutputBindings } from "./ui/output";
import { clamp } from "./util";

type DomRefs = {
	programInput: HTMLTextAreaElement;
	lineNumberInput: HTMLTextAreaElement;
	runButton: HTMLButtonElement;
	stepButton: HTMLButtonElement;
	stopButton: HTMLButtonElement;
	speedInput: HTMLInputElement;
	speedLabel: HTMLDivElement;
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
dom.speedLabel.textContent = formatSpeedLabel(speedIndex, speedDelaysMs);

let lineCount = initializeLineNumbers(dom.programInput, dom.lineNumberInput);

dom.programInput.addEventListener("input", (ev) => {
	const target = ev.target as HTMLTextAreaElement;
	resizeEditorContainer(target);
	const nextCount = target.value.split("\n").length;
	if (lineCount === nextCount) return;
	lineCount = nextCount;
	updateLineNumbers(dom.lineNumberInput, nextCount);
	syncLineNumberWidth(dom.lineNumberInput);
});

dom.speedInput.addEventListener("input", (ev) => {
	const target = ev.target as HTMLInputElement;
	speedIndex = clamp(0, Number(target.value), speedDelaysMs.length - 1);
	dom.speedLabel.textContent = formatSpeedLabel(speedIndex, speedDelaysMs);
});

dom.runButton.addEventListener("click", async () => {
	resetOutput(outputBindings);
	dom.runButton.disabled = true;
	dom.speedInput.disabled = true;
	const selectedSpeed = speedIndex;
	const machine = new ScsMachine(dom.programInput.value);
	const onStop = () => {
		machine.running = false;
		dom.runButton.disabled = false;
		dom.stepButton.disabled = true;
		dom.speedInput.disabled = false;
	};
	machine.onStop = onStop;
	dom.stopButton.addEventListener("click", onStop, { once: true });
	const renderer = createOutputRenderer(outputBindings, machine.lineCount);
	const updateOutput = () => renderer.update(machine.getOutput(), machine.getRegisters());
	try {
		machine.compile();
		machine.running = true;
		if (selectedSpeed === 0) {
			updateOutput();
			dom.stepButton.disabled = false;
			dom.stepButton.addEventListener("click", () => {
				if (!machine.running) return;
				try {
					const res = machine.step();
					updateOutput();
					renderer.highlight(res);
				} catch (e) {
					window.alert(e instanceof Error ? e.message : String(e));
					onStop();
					resetOutput(outputBindings);
				}
			});
		} else {
			while (machine.running) {
				const res = machine.step();
				// if (machine.stepCount > 1000) throw new Error("Too many steps, possible infinite loop");
				if (selectedSpeed === 5) {
					if (machine.stepCount % 10000 === 0) {
						console.log("updated");
						updateOutput();
						await new Promise((resolve) => setTimeout(resolve, 0));
					}
				} else {
					updateOutput();
					renderer.highlight(res);
					await new Promise((resolve) => setTimeout(resolve, speedDelaysMs[selectedSpeed]));
				}
			}
			updateOutput();
		}
	} catch (e) {
		window.alert(e instanceof Error ? e.message : String(e));
		onStop();
		resetOutput(outputBindings);
	} finally {
		dom.stopButton.removeEventListener("click", onStop);
	}
});

dom.stopButton.addEventListener("click", () => {
	resetOutput(outputBindings);
	dom.runButton.disabled = false;
	dom.stepButton.disabled = true;
	dom.speedInput.disabled = false;
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

function resizeEditorContainer(programInput: HTMLTextAreaElement) {
	programInput.parentElement!.style.height = "0px";
	programInput.parentElement!.style.height = `${programInput.scrollHeight + 1}px`;
}

function formatSpeedLabel(value: number, speedDelaysMs: number[]) {
	if (value === 0) return "ステップ実行";
	if (value === 5) return "最速";
	return `${speedDelaysMs[value]}ms/step`;
}
