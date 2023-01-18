import { EntropicComponent, JsonDataSource, Model, persistent, registerPersistentClass, Store } from 'entropic-bond'
import { CrudController, CrudControllerEvent } from './crud-controller'

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

interface TestControllerEvent extends CrudControllerEvent<Test> {
	newEvent: string
}

export class TestController extends CrudController<Test> {

	createDocument(): Test {
		return new Test()
	}

	protected getModel(): Model<Test> {
		return Store.getModel<Test>( 'Test' )
	}

	allRequiredPropertiesFilled(): boolean {
		return true
	}

	notifyNewEvent() {
		this.notifyChange<TestControllerEvent>({
			newEvent: 'new event fired'
		})
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
			datasource.simulateDelay( 50 )
		})

		it( 'should notify busy on delete', async ()=>{
			const promise = controller.deleteDocument()
			expect( onProgress ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: true }) )
			await promise
			expect( onProgress ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: false }) )
		})

		it( 'should notify busy on store', async ()=>{
			const promise = controller.storeDocument()
			expect( onProgress ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: true }) )
			await promise
			expect( onProgress ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: false }) )
		})
		
	})

	it( 'should notify new event', ()=>{
		const spy = jest.fn()
		controller.onChange( spy )
		controller.notifyNewEvent()

		expect( spy ).toHaveBeenCalledWith({ newEvent: 'new event fired' })
	})

	it( 'should not throw setting an undefined document', ()=>{
		expect(()=>{
			controller.setDocument( undefined )
		}).not.toThrow()
	})
	
	
})