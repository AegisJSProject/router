import { html } from '@aegisjsproject/core/parsers/html.js';

export default async ({ url: { matches } }) => {
	const username = matches?.pathname?.groups?.username;

	if (!username) {
		return html`<p>Error: No GitHub username provided.</p>`;
	}

	const apiUrl = `https://api.github.com/users/${encodeURIComponent(username)}`;
	const resp = await fetch(apiUrl, { referrerPolicy: 'no-referrer' });

	if (!resp.ok) {
		return html`<p>Error fetching GitHub user data: ${resp.statusText}</p>`;
	}

	const user = await resp.json();

	return html`
		<section>
			<h1>${user.name ?? username}</h1>
			<p><strong>Username:</strong> ${user.login}</p>
			<p><strong>Bio:</strong> ${user.bio ?? 'No bio available'}</p>
			<p><strong>Public Repos:</strong> ${user.public_repos}</p>
			<p><strong>Followers:</strong> ${user.followers}</p>
			<p><strong>Following:</strong> ${user.following}</p>
			${user.blog ? `<p><a href="${user.blog}" target="_blank">Website</a></p>` : ''}
			${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar" width="100" />` : ''}
		</section>
	`;
};
