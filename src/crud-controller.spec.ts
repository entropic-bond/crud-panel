import { EntropicComponent, JsonDataSource, Model, persistent, registerPersistentClass, required, requiredWithValidator, Store } from 'entropic-bond'
import { CrudController, CrudControllerEvent } from './crud-controller'
import { Mock } from 'vitest'

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

	set testPropWithValidator( value: string | undefined ) {
		this.changeProp( 'testPropWithValidator', value )
	}
	
	get testPropWithValidator(): string | undefined {
		return this._testPropWithValidator
	}
	
	@required @persistent private _testProp: string | undefined
	@requiredWithValidator(val => !!val && val?.length > 3 ) @persistent private _testPropWithValidator: string | undefined
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
	let onProgress: Mock

	beforeEach(()=>{
		datasource = new JsonDataSource(JSON.parse(JSON.stringify( mockData )))
		Store.useDataSource( datasource )
		controller = new TestController()
		onProgress = vi.fn()
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
		const spy = vi.fn()
		controller.onChange( spy )
		controller.notifyNewEvent()

		expect( spy ).toHaveBeenCalledWith({ newEvent: 'new event fired' })
	})

	it( 'should notify on filter set', async ()=>{
		const spy = vi.fn()
		controller.onChange( spy )
		await controller.setFilter( ()=>true )

		expect( spy ).toHaveBeenCalledWith({ action: 'filterChange' })
	})

	it( 'should return a filtered collection', async ()=>{
		const collection = await controller.documentCollection()
		expect( collection.length ).toBe( 2 )
		controller.setFilter( doc => doc.id === 'test1' )
		const filteredCollection = controller.filter( await controller.documentCollection() )
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

		afterEach( ()=>datasource.simulateError( undefined ) as any )

		describe( 'without observable', ()=>{
			beforeEach(()=>controller.setDocument( new Test() ) as any )
			
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
				const spy = vi.fn()
				controller.onError( spy )
				controller.callManagedThrow()
				expect( spy ).toHaveBeenCalledWith( Error( 'test error' ) )
			})
			
			it( 'should notify of an error on deleteDocument', async ()=>{
				const spy = vi.fn()
				controller.onError( spy )
				await controller.deleteDocument()
				expect( spy ).toHaveBeenCalledWith( Error( 'delete test error' ) )
			})
		
			it( 'should notify of an error on storeDocument', async ()=>{
				const spy = vi.fn()
				controller.onError( spy )
				await controller.storeDocument()
				expect( spy ).toHaveBeenCalledWith( Error( 'store test error' ) )
			})
		
			it( 'should notify of an error on documentCollection', async ()=>{
				const spy = vi.fn()
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
			controller.document!.testPropWithValidator = 'test'
			expect( controller.allRequiredPropertiesFilled() ).toBe( true )
		})

		it( 'should retrieve required properties', ()=>{
			expect( controller.requiredProperties ).toEqual( ['testProp', 'testPropWithValidator'] )
		})

		it( 'should work with registered prop validator', ()=>{
			controller.addValidator( 'testProp', ( value )=>value === 'validatedTest' )
			controller.document!.testProp = 'test'
			controller.document!.testPropWithValidator = 'test'
			expect( controller.allRequiredPropertiesFilled() ).toBe( false )
			controller.document!.testProp = 'validatedTest'
			expect( controller.allRequiredPropertiesFilled() ).toBe( true )
		})

		it( 'should work with decorator prop validator', ()=>{
			controller.document!.testProp = 'test'
			controller.document!.testPropWithValidator = 't'
			expect( controller.allRequiredPropertiesFilled() ).toBe( false )
			controller.document!.testPropWithValidator = 'validatedTest'
			expect( controller.allRequiredPropertiesFilled() ).toBe( true )
		})

		it( 'should retrieve validator errors', ()=>{
			controller.addValidator( 'testProp', ( value )=>value === 'validatedTest', 'testPropError' )
			controller.document!.testPropWithValidator = 't'
			expect( controller.failedValidationError( 'testProp' ) ).toEqual( 'testPropError' )
		})
	})
})