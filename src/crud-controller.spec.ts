import { EntropicComponent, JsonDataSource, Model, persistent, registerPersistentClass, Store } from 'entropic-bond'
import { CrudController } from './crud-controller'

const mockData = {
	Test: {
		test1:{
			__className: 'Test',
			id: 'test1',
			testProp: 'Test prop 1'
		},
		test2:{
			__className: 'Test',
			id: 'test2',
			testProp: 'Test prop 2'
		}
	}
}

@registerPersistentClass( 'Test' )
export class Test extends EntropicComponent {
	set testProp( value: string ) {
		this.changeProp('testProp', value )
	}
	
	get testProp(): string {
		return this._testProp
	}
	
	@persistent private _testProp: string
}

export class TestController extends CrudController<Test> {

	createDocument(): Test {
		return new Test()
	}

	protected getModel(): Model<Test> {
		return Store.getModel( 'Test' )
	}

	allRequiredPropertiesFilled(): boolean {
		return true
	}
}

describe( 'Crud Controller', ()=>{
	let controller: TestController
	let datasource: JsonDataSource
	let onProgress: jest.Mock

	beforeEach(()=>{
		datasource = new JsonDataSource({ ...mockData })
		Store.useDataSource( datasource )
		controller = new TestController()
		onProgress = jest.fn()
		controller.onProgress( onProgress )
	})

	describe( 'Long operations', ()=>{
		
		beforeEach(()=>{
			datasource.simulateDelay( 500 )
		})

		it( 'should notify busy on delete', async ()=>{
			controller.deleteDocument( new Test() )
			expect( onProgress ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: true }) )
			await datasource.wait()
			expect( onProgress ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: false }) )
		})
	})
})