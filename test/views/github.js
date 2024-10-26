import { manageState } from '@aegisjsproject/state';

const [users, setUsers] = manageState('github:users', {});
const url = (strings, ...values) => String.raw(strings, ...values.map(val => encodeURIComponent(val)));

export default async ({ matches, signal }) => {
	const username = matches?.pathname?.groups?.username;

	if (typeof username !== 'string') {
		return `<p>Error: No GitHub username provided.</p>`;
	} else if (! (username in users)) {
		const apiUrl = url`https://api.github.com/users/${username}`;
		const resp = await fetch(apiUrl, { referrerPolicy: 'no-referrer' });

		if (!resp.ok) {
			return `<p>Error fetching GitHub user data: ${resp.statusText}</p>`;
		}

		setUsers({ ...users, [username]: await resp.json() });
	}

	signal.addEventListener('abort', ({ target }) => console.info(target.reason), { once: true });

	return `
		<section>
			<template shadowrootmode="open">
				<h1>${users[username].name ?? username}</h1>
				<p><strong>Username:</strong> ${users[username].login}</p>
				<p><strong>Bio:</strong> ${users[username].bio ?? 'No bio available'}</p>
				<p><strong>Public Repos:</strong> ${users[username].public_repos}</p>
				<p><strong>Followers:</strong> ${users[username].followers}</p>
				<p><strong>Following:</strong> ${users[username].following}</p>
				${users[username].blog ? `<p><a href="${users[username].blog}" target="_blank">Website</a></p>` : ''}
				${users[username].avatar_url ? `<img src="${users[username].avatar_url}" alt="Avatar" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" width="100" />` : ''}
			</template>
		</section>
	`;
};
