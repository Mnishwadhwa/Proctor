import terser from '@rollup/plugin-terser';

export default [
  // UMD build (for script tag usage)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/proctor.umd.js',
      format: 'umd',
      name: 'Proctor',
      sourcemap: true
    }
  },
  // ESM build (for module imports)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/proctor.esm.js',
      format: 'esm',
      sourcemap: true
    }
  },
  // Minified build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/proctor.min.js',
      format: 'umd',
      name: 'Proctor',
      sourcemap: true
    },
    plugins: [terser()]
  }
];