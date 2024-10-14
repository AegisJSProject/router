import nodeResolve from '@rollup/plugin-node-resolve';

export default [{
	input: 'router.js',
	plugins: [nodeResolve()],
	output: [{
		file: 'router.cjs',
		format: 'cjs',
	}],
}];
