import { EntropicComponent, JsonDataSource, Model, persistent, registerPersistentClass, required, Store } from 'entropic-bond'
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
	set testProp( value: string | undefined ) {
		this.changeProp('testProp', value )
	}
	
	get testProp(): string | undefined {
		return this._testProp
	}

	@required @persistent private _testProp: string | undefined
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

	notifyNewEvent() {
		this.notifyChange<TestControllerEvent>({
			newEvent: 'new event fired'
		})
	}

	callManagedThrow() {
		this.managedThrow( new Error('test error') )
	}

}

describe( 'Crud Controller', ()=>{
	let controller: TestController
	let datasource: JsonDataSource
	let onProgress: jest.Mock

	beforeEach(()=>{
		datasource = new JsonDataSource(JSON.parse(JSON.stringify( mockData )))
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

	it( 'should notify on filter set', async ()=>{
		const spy = jest.fn()
		controller.onChange( spy )
		await controller.setFilter( ()=>true )

		expect( spy ).toHaveBeenCalledWith({ documentCollection: expect.anything() })
	})

	it( 'should return a filtered collection', async ()=>{
		const collection = await controller.documentCollection()
		expect( collection.length ).toBe( 2 )
		controller.setFilter( doc => doc.id === 'test1' )
		const filteredCollection = await controller.documentCollection()
		expect( filteredCollection.length ).toBe( 1 )
	})

	describe( 'Error handling', ()=>{
		beforeEach(()=>{		
			datasource.simulateError({
				store: 'store test error',
				delete: 'delete test error',
				find: 'find test error',
				findById: 'findById test error',
			})
			controller.setDocument( new Test() )
		})

		afterEach(()=>datasource.simulateError( undefined ))

		describe( 'without observable', ()=>{
			beforeEach(()=>controller.setDocument( new Test() ))
			
			it( 'should throw on managedThrow', ()=>{
				expect(()=>{
					controller.callManagedThrow()
				}).toThrow( 'test error' )
			})

			it( 'should reject of an error on deleteDocument', async ()=>{
				expect( controller.deleteDocument() ).rejects.toThrow( 'delete test error' )
			})
		
			it( 'should reject of an error on storeDocument', async ()=>{
				expect( controller.storeDocument() ).rejects.toThrow( 'store test error' )
			})
		
			it( 'should reject of an error on documentCollection', async ()=>{
				expect( controller.documentCollection() ).rejects.toThrow( 'find test error' )
			})
		})

		describe( 'with observable', ()=>{
		
			it( 'should notify of an error on managedThrow', ()=>{
				const spy = jest.fn()
				controller.onError( spy )
				controller.callManagedThrow()
				expect( spy ).toHaveBeenCalledWith( Error( 'test error' ) )
			})
			
			it( 'should notify of an error on deleteDocument', async ()=>{
				const spy = jest.fn()
				controller.onError( spy )
				await controller.deleteDocument()
				expect( spy ).toHaveBeenCalledWith( Error( 'delete test error' ) )
			})
		
			it( 'should notify of an error on storeDocument', async ()=>{
				const spy = jest.fn()
				controller.onError( spy )
				await controller.storeDocument()
				expect( spy ).toHaveBeenCalledWith( Error( 'store test error' ) )
			})
		
			it( 'should notify of an error on documentCollection', async ()=>{
				const spy = jest.fn()
				controller.onError( spy )
				await controller.documentCollection()
				expect( spy ).toHaveBeenCalledWith( Error( 'find test error' ) )
			})
		
		})
	})

	describe( 'Required properties', ()=>{
		it( 'should return false if not all required properties are filled', ()=>{
			expect( controller.allRequiredPropertiesFilled() ).toBe( false )
		})

		it( 'should return true if all required properties are filled', ()=>{
			controller.document!.testProp = 'test'
			expect( controller.allRequiredPropertiesFilled() ).toBe( true )
		})

		it( 'should retrieve required properties', ()=>{
			expect( controller.requiredProperties ).toEqual( ['testProp'] )
		})

		it( 'should work with registered prop validator', ()=>{
			controller.addValidator( 'testProp', ( value )=>value === 'test' )
			expect( controller.allRequiredPropertiesFilled() ).toBe( false )
			controller.document!.testProp = 'test'
			expect( controller.allRequiredPropertiesFilled() ).toBe( true )
		})
	})
})