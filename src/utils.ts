export const toId = (str: string) =>
	str.replaceAll(/[\\|!\"#$%\(\)\[\]=\{\}'\?`^~\+\*:\.,;/]/g, '').replaceAll(' ', '');
