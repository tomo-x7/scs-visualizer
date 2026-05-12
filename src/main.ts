import { SCS } from "./scs";
import "./style.css";
import { clamp } from "./util";

const programTextArea = document.querySelector<HTMLTextAreaElement>("#program")!;
const lineNumTextArea = document.querySelector<HTMLTextAreaElement>("#linenum")!;

const runButton = document.querySelector<HTMLButtonElement>("#run")!;
const stepButton = document.querySelector<HTMLButtonElement>("#step")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop")!;

const output = document.querySelector<HTMLDivElement>("#memories")!;
const stepsOutput = document.querySelector<HTMLDivElement>("#steps>.value")!;
const pcOutput = document.querySelector<HTMLDivElement>("#pc>.value")!;
const accOutput = document.querySelector<HTMLDivElement>("#acc>.value")!;
const idxOutput = document.querySelector<HTMLDivElement>("#idx>.value")!;

const speedInput = document.querySelector<HTMLInputElement>("#speed")!;
const speedLabel = document.querySelector<HTMLLabelElement>("#speedlabel")!;
clearOutput();

let lineCount = programTextArea.value.split("\n").length;
lineNumTextArea.value = Array.from({ length: lineCount }, (_, i) => i).join("\n");
programTextArea.addEventListener("input", (ev) => {
	const target = ev.target as HTMLTextAreaElement;
	target.parentElement!.style.height = "0px";
	target.parentElement!.style.height = `${target.scrollHeight + 1}px`;
	const nc = target.value.split("\n").length;
	if (lineCount === nc) return;
	lineCount = nc;
	lineNumTextArea.value = Array.from({ length: nc }, (_, i) => i).join("\n");
	lineNumTextArea.style.width = "0px";
	lineNumTextArea.style.width = `${Math.max(30, lineNumTextArea.scrollWidth + 10)}px`;
});
let speed = 0;
const speeds = [0, 1000, 500, 100, 50, 0];
speedInput.addEventListener("input", (ev) => {
	const target = ev.target as HTMLInputElement;
	speed = clamp(0, Number(target.value), speeds.length - 1);
	speedLabel.textContent = parseSpeedView(speed);
});
speed = Number(speedInput.value);
speedLabel.textContent = parseSpeedView(speed);
function parseSpeedView(value: number) {
	if (value === 0) return "ステップ実行";
	if (value === 5) return "最速";
	return `${speeds[value]}ms/step`;
}

runButton.addEventListener("click", async (ev) => {
	clearOutput();
	runButton.disabled = true;
	speedInput.disabled = true;
	const cspeed = speed;
	const scs = new SCS(programTextArea.value);
	const onStop = () => {
		scs.running = false;
		runButton.disabled = false;
		stepButton.disabled = true;
		speedInput.disabled = false;
	};
	scs.onStop = onStop;
	stopButton.addEventListener("click", onStop, { once: true });
	const updateOutputInner = genOutput(scs.lineCount);
	const updateOutput = () => updateOutputInner(scs.getOutput(), scs.getRegisters());
	try {
		scs.compile();
		scs.running = true;
		if (cspeed === 0) {
			updateOutput();
			stepButton.disabled = false;
			console.log(stepButton.disabled);
			stepButton.addEventListener("click", (ev) => {
				if (!scs.running) return;
				try {
					scs.step();
					updateOutput();
				} catch (e) {
					window.alert(e instanceof Error ? e.message : String(e));
					onStop();
					clearOutput();
				}
			});
		} else {
			while (scs.running) {
				scs.step();
				if (scs.stepCount > 1000) throw new Error("Too many steps, possible infinite loop");
				if (cspeed === 5) {
					if (scs.stepCount % 100 === 0) {
						updateOutput();
					}
				} else {
					updateOutput();
					await new Promise((resolve) => setTimeout(resolve, speeds[cspeed]));
				}
			}
			updateOutput();
		}
	} catch (e) {
		window.alert(e instanceof Error ? e.message : String(e));
		onStop();
		clearOutput();
	} finally {
		stopButton.removeEventListener("click", onStop);
	}
});
stopButton.addEventListener("click", (ev) => {
	clearOutput();
	runButton.disabled = false;
	stepButton.disabled = true;
	speedInput.disabled = false;
});
function clearOutput() {
	output.innerHTML = "";

	const parent = document.createElement("div");
	const addr = document.createElement("div");
	const code = document.createElement("div");
	const memory = document.createElement("div");
	const mem10 = document.createElement("div");
	addr.textContent = "addr";
	code.textContent = "code";
	memory.textContent = "memory";
	mem10.textContent = "memory(10)";
	mem10.classList.add("mem10");
	parent.classList.add("header");
	parent.appendChild(addr);
	parent.appendChild(code);
	parent.appendChild(memory);
	parent.appendChild(mem10);
	output.appendChild(parent);

	accOutput.textContent = "0";
	idxOutput.textContent = "0";
	pcOutput.textContent = "0";
	stepsOutput.textContent = "0";
}
function genOutput(length: number) {
	const outputEls: {
		parent: HTMLDivElement;
		addr: HTMLDivElement;
		code: HTMLDivElement;
		memory: HTMLDivElement;
		mem10: HTMLDivElement;
	}[] = [];
	for (let i = 0; i < length; i++) {
		const parent = document.createElement("div");
		const addr = document.createElement("div");
		const code = document.createElement("div");
		const memory = document.createElement("div");
		const mem10 = document.createElement("div");
		mem10.classList.add("mem10");
		parent.appendChild(addr);
		parent.appendChild(code);
		parent.appendChild(memory);
		parent.appendChild(mem10);
		outputEls.push({ parent, addr, code, memory, mem10 });
		output.appendChild(parent);
	}
	return (
		memdata: {
			addr: number;
			memory: number;
			code: string;
		}[],
		regdata: {
			pc: number;
			acc: number;
			idx: number;
			step: number;
		},
	) => {
		for (let i = 0; i < length; i++) {
			const { addr, code, memory } = memdata[i];
			outputEls[i].addr.textContent = addr.toString(10);
			outputEls[i].code.textContent = code;
			outputEls[i].memory.textContent = memory.toString(16);
			outputEls[i].mem10.textContent = memory.toString(10);
		}
		stepsOutput.textContent = regdata.step.toString(10);
		pcOutput.textContent = regdata.pc.toString(10);
		accOutput.textContent = regdata.acc.toString(10);
		idxOutput.textContent = regdata.idx.toString(10);
	};
}
