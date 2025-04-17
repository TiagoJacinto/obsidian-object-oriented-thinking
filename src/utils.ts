import * as time from 'date-fns';

export const toId = (str: string) =>
	str.replaceAll(/[\\|!\"#$%\(\)\[\]=\{\}'\?`^~\+\*:\.,;/]/g, '').replaceAll(' ', '');

const dateFormat = "yyyy-MM-dd'T'HH:mm";

export const formatDate = (input: Date) => time.format(input, dateFormat);

export function parseDate(input: string): Date | null;
export function parseDate(input: number): Date;
export function parseDate(input: string | number) {
	if (typeof input === 'string') {
		try {
			const parsedDate = time.parse(input, dateFormat, new Date());

			if (isNaN(parsedDate.getTime())) return null;

			return parsedDate;
		} catch (e) {
			console.error(e);
			return null;
		}
	}
	return new Date(input);
}
