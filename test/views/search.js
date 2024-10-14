export default (params) => {
	const pre = document.createElement('pre');
	const code = document.createElement('code');
	code.textContent = JSON.stringify(params, null, 4);
	pre.append(code);
	return pre;
};
