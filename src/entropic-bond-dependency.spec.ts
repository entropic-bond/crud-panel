import manifest from '../package.json'
import lock from '../package-lock.json'

describe( 'crud-panel works on entropic-bond 2.x [REQ-1]', ()=>{

	it( 'The package resolves entropic-bond 2.0.4 under the declared 2.x range. [REQ-1]', ()=>{
		const declaredRange = manifest.dependencies[ 'entropic-bond' ]
		expect( declaredRange ).toBe( '^2.0.4' )

		const expectedVersion = declaredRange.replace( '^', '' )
		const lockedVersion = lock.packages[ 'node_modules/entropic-bond' ].version

		expect( lockedVersion ).toBe( expectedVersion )
	})
})
