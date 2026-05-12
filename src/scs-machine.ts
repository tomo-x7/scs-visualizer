import { assertValidLabel, isLabel, isNumber, type operandTable, parseNumber, parseOperand } from "./util";

export type RegisterState = {
	pc: number;
	acc: number;
	idx: number;
	step: number;
};

export type MemoryRow = {
	addr: number;
	memory: number;
	code: string;
};

export type StepResult = {
	pc: number;
	affects: (number | "acc" | "idx")[];
};

type OpCode = (typeof operandTable)[keyof typeof operandTable]["op"][number];

export class ScsMachine {
	public running = false;
	public lineCount = 0;
	public stepCount = 0;
	public onStop: (() => void) | undefined = undefined;

	private programLines: string[];
	private memory: number[] = [];
	private labelAddressMap = new Map<string, number>();

	private pc = 0;
	private acc = 0;
	private idx = 0;

	constructor(program: string) {
		this.programLines = program.split("\n");
		this.lineCount = this.programLines.length;
	}

	compile() {
		this.resetForCompile();
		this.collectLabels();
		this.encodeInstructions();
	}

	step(): StepResult | undefined {
		if (!this.running) return;
		if (this.pc < 0 || this.pc >= this.memory.length) {
			this.running = false;
			this.onStop?.();
			throw new Error(`PC out of bounds: ${this.pc}`);
		}
		this.stepCount++;
		const instruction = this.memory[this.pc];
		const opcode = ((instruction >> 16) & 0xff) as OpCode;
		const arg = instruction & 0xffff;
		return { pc: this.pc, affects: this.executeOpcode(opcode, arg) };
	}

	getRegisters(): RegisterState {
		return {
			pc: this.pc,
			acc: this.acc,
			idx: this.idx,
			step: this.stepCount,
		};
	}

	getOutput(): MemoryRow[] {
		return this.memory.map((value, index) => ({ addr: index, memory: value, code: this.programLines[index] }));
	}

	private resetForCompile() {
		this.labelAddressMap.clear();
		this.memory = new Array(this.programLines.length).fill(0);
	}

	private collectLabels() {
		for (let lineCount = 0; lineCount < this.programLines.length; lineCount++) {
			const line = this.programLines[lineCount];
			if (!line.includes(":")) continue;
			const [labelPart, codePart] = line.split(":");
			if (codePart.includes(":")) throw new Error(`Invalid ":" at addr ${lineCount}: ${line}`);
			const label = labelPart.trim();
			assertValidLabel(label, lineCount);
			if (this.labelAddressMap.has(label)) throw new Error(`Duplicate label at addr ${lineCount}: ${label}`);
			this.labelAddressMap.set(label, lineCount);
		}
	}

	private encodeInstructions() {
		for (let lineCount = 0; lineCount < this.programLines.length; lineCount++) {
			const line = this.programLines[lineCount];
			let code: string;
			if (line.includes(":")) {
				code = line.split(":")[1].trim();
			} else {
				code = line.trim();
			}
			if (code === "") continue;
			if (code.split(" ").length > 2) throw new Error(`Invalid instruction at addr ${lineCount}: ${code}`);
			const [operand, arg] = code.split(" ").map((s) => s.trim());
			let opcode: number;
			let argValue: number;
			if (arg == null || arg === "") {
				if (isNumber(operand)) {
					opcode = 0;
					argValue = parseNumber(operand);
				} else {
					argValue = 0;
					opcode = parseOperand(operand, lineCount);
				}
			} else if (isNumber(arg)) {
				opcode = parseOperand(operand, lineCount, false);
				argValue = parseNumber(arg) & 0xffff;
			} else if (isLabel(arg)) {
				opcode = parseOperand(operand, lineCount, true);
				const resolved = this.labelAddressMap.get(arg);
				if (resolved === undefined) throw new Error(`Undefined label at addr ${lineCount}: ${arg}`);
				argValue = resolved & 0xffff;
			} else {
				throw new Error(`Invalid operand at addr ${lineCount}: ${arg}`);
			}
			this.memory[lineCount] = (opcode << 16) | argValue;
		}
	}

	private executeOpcode(opcode: OpCode, arg: number): (number | "acc" | "idx")[] {
		switch (opcode) {
			case 0x00:
			case 0x01: {
				// nop
				this.pc++;
				return [];
			}
			case 0x02:
			case 0x03: {
				// stop
				this.running = false;
				this.onStop?.();
				return [];
			}
			case 0x04: {
				// load
				this.acc = arg;
				this.pc++;
				return ["acc"];
			}
			case 0x05: {
				// load
				this.acc = this.memory[arg];
				this.pc++;
				return ["acc", arg];
			}
			case 0x06: {
				// loadx
				this.acc = arg + this.idx;
				this.pc++;
				return ["acc"];
			}
			case 0x07: {
				// loadx
				this.acc = this.memory[arg + this.idx];
				this.pc++;
				return ["acc", arg + this.idx];
			}
			case 0x08:
			case 0x09: {
				// store
				this.memory[arg] = this.acc;
				this.pc++;
				return [arg, "acc"];
			}
			case 0x0a:
			case 0x0b: {
				// storex
				this.memory[arg + this.idx] = this.acc;
				this.pc++;
				return [arg + this.idx, "acc"];
			}
			case 0x0c: {
				// add
				this.acc += arg;
				this.pc++;
				return ["acc"];
			}
			case 0x0d: {
				// add
				this.acc += this.memory[arg];
				this.pc++;
				return ["acc", arg];
			}
			case 0x0e: {
				// sub
				this.acc -= arg;
				this.pc++;
				return ["acc"];
			}
			case 0x0f: {
				// sub
				this.acc -= this.memory[arg];
				this.pc++;
				return ["acc", arg];
			}
			case 0x10: {
				// iload
				this.idx = arg;
				this.pc++;
				return ["idx"];
			}
			case 0x11: {
				// iload
				this.idx = this.memory[arg];
				this.pc++;
				return ["idx", arg];
			}
			case 0x12: {
				// iadd
				this.idx += arg;
				this.pc++;
				return ["idx"];
			}
			case 0x13: {
				// iadd
				this.idx += this.memory[arg];
				this.pc++;
				return ["idx", arg];
			}
			case 0x14: {
				// isub
				this.idx -= arg;
				this.pc++;
				return ["idx"];
			}
			case 0x15: {
				// isub
				this.idx -= this.memory[arg];
				this.pc++;
				return ["idx", arg];
			}
			case 0x16:
			case 0x17: {
				// ifz
				if (this.acc === 0) {
					this.pc = arg;
					return [arg];
				} else {
					this.pc++;
					return [];
				}
			}
			case 0x18:
			case 0x19: {
				// ifnz
				if (this.acc !== 0) {
					this.pc = arg;
					return [arg];
				} else {
					this.pc++;
					return [];
				}
			}
			case 0x1a:
			case 0x1b: {
				// ifp
				if (this.acc > 0) {
					this.pc = arg;
					return [arg];
				} else {
					this.pc++;
					return [];
				}
			}
			case 0x1c:
			case 0x1d: {
				// ifn
				if (this.acc < 0) {
					this.pc = arg;
					return [arg];
				} else {
					this.pc++;
					return [];
				}
			}
			case 0x1e:
			case 0x1f: {
				// jump
				this.pc = arg;
				return [arg];
			}
			case 0x20:
			case 0x21: {
				// neg
				this.acc *= -1;
				this.pc++;
				return ["acc"];
			}
			default: {
				const n: never = opcode;
				throw new Error(`Invalid opcode at addr ${this.pc}: ${opcode}`);
			}
		}
	}
}
