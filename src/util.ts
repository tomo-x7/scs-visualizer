export function isNumber(str: string, allowMinus?: boolean): boolean {
	if (!isValidNumberLike(str)) return false;
	try {
		const n = parseNumber(str);
		if (Number.isNaN(n)) return false;
		if (allowMinus) {
			return true;
		} else {
			return n >= 0;
		}
	} catch {
		return false;
	}
}
export function isValidNumberLike(str: string) {
	if (str.startsWith("0x") || str.startsWith("0X")) return /^0x[\da-f-]+$/i.test(str);
	return /^(0b|0o|0d|0x)?[\d-]+$/i.test(str);
}
export function parseNumber(str: string): number {
	str = str.toLowerCase();
	if (str.startsWith("0b")) {
		return parseInt(str.slice(2), 2);
	} else if (str.startsWith("0o")) {
		return parseInt(str.slice(2), 8);
	} else if (str.startsWith("0d")) {
		return parseInt(str.slice(2), 10);
	} else if (str.startsWith("0x")) {
		return parseInt(str.slice(2), 16);
	} else {
		return parseInt(str, 10);
	}
}
export function isLabel(str: string): boolean {
	return /^[a-zA-Z][a-zA-Z0-9]*$/.test(str);
}
export function assertValidLabel(label: string, line: number) {
	if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(label)) {
		throw new Error(`Invalid label at addr ${line}: ${label}`);
	}
}
export const operandTable = {
	nop: { op: [0x00, 0x01] },
	stop: { op: [0x02, 0x03] },
	load: { op: [0x04, 0x05] },
	loadx: { op: [0x06, 0x07] },
	store: { op: [0x08, 0x09] },
	storex: { op: [0x0a, 0x0b] },
	add: { op: [0x0c, 0x0d] },
	sub: { op: [0x0e, 0x0f] },
	iload: { op: [0x10, 0x11] },
	iadd: { op: [0x12, 0x13] },
	isub: { op: [0x14, 0x15] },
	ifz: { op: [0x16, 0x17] },
	ifnz: { op: [0x18, 0x19] },
	ifp: { op: [0x1a, 0x1b] },
	ifn: { op: [0x1c, 0x1d] },
	jump: { op: [0x1e, 0x1f] },
	neg: { op: [0x20, 0x21] },
} as const;
export function assertValidOperand(operand: string, line: number): asserts operand is keyof typeof operandTable {
	if (!(operand in operandTable)) {
		throw new Error(`Invalid operand at addr ${line}: ${operand}`);
	}
}
export function parseOperand(operand: string, line: number, isLabel?: boolean): number {
	assertValidOperand(operand, line);
	return operandTable[operand].op[isLabel === false ? 0 : 1];
}
export function clamp(min: number, num: number, max: number) {
	return Math.min(Math.max(num, min), max);
}
