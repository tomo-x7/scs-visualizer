import { assertValidLabel, isLabel, isNumber, type operandTable, parseNumber, parseOperand } from "./util";

export class SCS {
	public running = false;

	private lines: string[];
	public lineCount = 0;
	private memory: number[] = [];
	private labelMap = new Map<string, number>();

	private pc = 0;
	private acc = 0;
	private idx = 0;
	public stepCount = 0;

	public onStop: (() => void) | undefined = undefined;

	constructor(program: string) {
		this.lines = program.split("\n");
		this.lineCount = this.lines.length;
	}

	compile() {
		this.labelMap.clear();
		this.memory = new Array(this.lines.length).fill(0);
		for (let lineCount = 0; lineCount < this.lines.length; lineCount++) {
			const line = this.lines[lineCount];
			if (!line.includes(":")) continue;
			const [_label, _code] = line.split(":");
			if (_code.includes(":")) throw new Error(`Invalid ":" at addr ${lineCount}: ${line}`);
			const label = _label.trim();
			assertValidLabel(label, lineCount);
			if (this.labelMap.has(label)) throw new Error(`Duplicate label at addr ${lineCount}: ${label}`);
			this.labelMap.set(label, lineCount);
		}
		for (let lineCount = 0; lineCount < this.lines.length; lineCount++) {
			const line = this.lines[lineCount];
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
				const _argValue = this.labelMap.get(arg);
				if (_argValue === undefined) throw new Error(`Undefined label at addr ${lineCount}: ${arg}`);
				argValue = _argValue & 0xffff;
			} else {
				throw new Error(`Invalid operand at addr ${lineCount}: ${arg}`);
			}
			this.memory[lineCount] = (opcode << 16) | argValue;
		}
	}
	step() {
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
		return { pc: this.pc, affects: this.exec(opcode, arg) };
	}
	getRegisters() {
		return {
			pc: this.pc,
			acc: this.acc,
			idx: this.idx,
			step: this.stepCount,
		};
	}
	getOutput() {
		return this.memory.map((v, i) => ({ addr: i, memory: v, code: this.lines[i] }));
	}

	private exec(opcode: OpCode, arg: number): (number | "acc" | "idx")[] {
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
type OpCode = (typeof operandTable)[keyof typeof operandTable]["op"][number];
