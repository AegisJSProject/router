import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default [{
	input: 'router.js',
	plugins: [nodeResolve()],
	external: ['@aegisjsproject/state'],
	output: [{
		file: 'router.cjs',
		format: 'cjs',
	}, {
		file: 'router.mjs',
		format: 'esm',
		plugins: [terser()],
		sourcemap: true,
	}],
}];
