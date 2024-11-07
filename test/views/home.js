import { btn, btnOutlineDanger } from '@aegisjsproject/styles/button.js';

export default ({ signal }) => {
	const dialog = document.createElement('dialog');
	const container = document.createElement('div');
	const shadow = container.attachShadow({ mode: 'open' });
	const close = document.createElement('button');
	const p = document.createElement('p');
	const watcher = new CloseWatcher();

	p.textContent = 'Hello, World!';
	close.type = 'button';
	close.textContent = 'X';
	close.title = 'Close';
	close.accessKey = 'x';
	close.classList.add('btn', 'btn-outline-danger');

	dialog.addEventListener('close', ({ target }) => target.remove(), { once: true, signal });
	close.addEventListener('click', watcher.requestClose.bind(watcher), { signal });
	watcher.addEventListener('close', () => dialog.close(), { once: true, signal });
	signal.addEventListener('abort', () => {
		if (dialog.isConnected) {
			dialog.close();
			dialog.remove();
		}
	}, { once: true });

	const anim = dialog.animate([
		{ opacity: 0, transform: 'scale(0)' },
		{ opacity: 1, transform: 'none' },
	], {
		duration: 400,
		easing: 'ease-out',
	});

	anim.pause();

	setTimeout(() => {
		if (dialog.isConnected) {
			anim.play();
			dialog.showModal();
		}
	}, 50);

	shadow.append(close, p);
	shadow.adoptedStyleSheets = [btn, btnOutlineDanger];
	dialog.append(container);

	return dialog;
};
