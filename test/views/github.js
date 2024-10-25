import { html } from '@aegisjsproject/core/parsers/html.js';
import { manageState } from '@aegisjsproject/state';

const [users, setUsers] = manageState('github:users', {});

export default async ({ matches }) => {
	const username = matches?.pathname?.groups?.username;

	if (typeof username !== 'string') {
		return html`<p>Error: No GitHub username provided.</p>`;
	} else if (! (username in users)) {
		const apiUrl = `https://api.github.com/users/${encodeURIComponent(username)}`;
		const resp = await fetch(apiUrl, { referrerPolicy: 'no-referrer' });

		if (!resp.ok) {
			return html`<p>Error fetching GitHub user data: ${resp.statusText}</p>`;
		}
		setUsers({ ...users, [username]: await resp.json() });
	}

	return html`
		<section>
			<h1>${users[username].name ?? username}</h1>
			<p><strong>Username:</strong> ${users[username].login}</p>
			<p><strong>Bio:</strong> ${users[username].bio ?? 'No bio available'}</p>
			<p><strong>Public Repos:</strong> ${users[username].public_repos}</p>
			<p><strong>Followers:</strong> ${users[username].followers}</p>
			<p><strong>Following:</strong> ${users[username].following}</p>
			${users[username].blog ? `<p><a href="${users[username].blog}" target="_blank">Website</a></p>` : ''}
			${users[username].avatar_url ? `<img src="${users[username].avatar_url}" alt="Avatar" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" width="100" />` : ''}
		</section>
	`;
};
