import { error } from '@sveltejs/kit';
import { getRequirement, vector } from '$lib/content/solutions';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const requirement = getRequirement(vector, params.requirement);
	if (!requirement) {
		error(404, 'Requirement not found');
	}
	return { requirement };
};
