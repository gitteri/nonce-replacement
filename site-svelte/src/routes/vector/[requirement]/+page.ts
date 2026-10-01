import { error } from '@sveltejs/kit';
import { getRequirement } from '$lib/content/requirements';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const requirement = getRequirement(params.requirement);
	if (!requirement) {
		error(404, 'Requirement not found');
	}
	return { requirement };
};
