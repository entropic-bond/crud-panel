export function snakeCase( str: string, snakeChar: string = '-' ) {
	return str[0].toLocaleLowerCase() + str.slice(1).replace(/([A-Z])/g, g => snakeChar + g[0].toLowerCase() );
}
