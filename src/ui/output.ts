import type { MemoryRow, RegisterState, StepResult } from "../scs-machine";

export type OutputBindings = {
	output: HTMLDivElement;
	stepsOutput: HTMLDivElement;
	pcOutput: HTMLDivElement;
	accOutput: HTMLDivElement;
	idxOutput: HTMLDivElement;
};

export type OutputRenderer = {
	update: (memdata: MemoryRow[], regdata: RegisterState) => void;
	highlight: (target: StepResult | undefined) => void;
};

export function resetOutput(bindings: OutputBindings) {
	const { output, accOutput, idxOutput, pcOutput, stepsOutput } = bindings;
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

export function createOutputRenderer(bindings: OutputBindings, length: number): OutputRenderer {
	const { output, accOutput, idxOutput, pcOutput, stepsOutput } = bindings;
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

	const update = (memdata: MemoryRow[], regdata: RegisterState) => {
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

	const highlight = (target: StepResult | undefined) => {
		if (target == null) return;
		for (const el of outputEls) {
			el.parent.classList.remove("pc-hilight");
			el.parent.classList.remove("affect-highlight");
		}
		accOutput.classList.remove("affect-highlight");
		idxOutput.classList.remove("affect-highlight");
		outputEls[target.pc]?.parent.classList.add("pc-hilight");
		for (const affect of target.affects) {
			if (affect === "acc") {
				accOutput.classList.add("affect-highlight");
			} else if (affect === "idx") {
				idxOutput.classList.add("affect-highlight");
			} else {
				outputEls[affect]?.parent.classList.add("affect-highlight");
			}
		}
	};

	return { update, highlight };
}
