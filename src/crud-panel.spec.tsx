import React, { Component } from 'react'
import { render, RenderResult, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntropicComponent, JsonDataSource, Model, persistent, Persistent, registerPersistentClass, Store } from 'entropic-bond'
import { CrudContentViewProps, CrudPanel, CrudPanelLabels, CrudCardProps, Layout } from './crud-panel'
import { CrudController } from './crud-controller'

const crudLabels: CrudPanelLabels = {
	addNewDocumentLabel: 'Add new document',
	addButtonLabel: 'Add',
	updateButtonLabel: 'Update',
	documentsInCollectionCaption: 'Existing documents',
	noDocumentsFoundLabel: 'No documents found',
}

const testViewPlaceholder = 'Test View Placeholder'
const editButtonLabel = 'Edit'
const deleteButtonLabel = 'Delete'
const cancelButtonCaption = 'Cancel'
const viewHeader = 'View header'

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
class Test extends EntropicComponent {
	set testProp( value: string ) {
		this.changeProp('testProp', value )
	}
	
	get testProp(): string {
		return this._testProp
	}
	
	@persistent private _testProp: string
}

class TestController extends CrudController<Test> {

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

class TestView extends Component<Partial<CrudContentViewProps<Test>>> {
	componentDidMount(): void {
		const { document } = this.props
		
		document.onChange(() => this.setState({}))
	}

	render() {
		const { document, onCancel, onSubmit, submitButtonCaption } = this.props

		return (
			<div>
				<h1>{ viewHeader }</h1>
				<input 
					placeholder={ testViewPlaceholder }
					value={ document.testProp || '' } 
					onChange={ e => document.testProp = e.target.value } 
				/>
				<button onClick={ ()=>onSubmit( document ) }>{ submitButtonCaption }</button>
				<button onClick={ onCancel }>{ cancelButtonCaption }</button>
			</div>
		)
	}
}

class TestCard extends Component<Partial<CrudCardProps<Test>>> {
	render() {
		const { document, onDelete, onSelect } = this.props

		return (
			<div>
				<p>{ document?.testProp }</p>
				<button onClick={ ()=>onSelect( document ) }>{ editButtonLabel }</button>
				<button onClick={ ()=>onDelete( document ) }>{ deleteButtonLabel }</button>
			</div>  
		)
	}
}

describe( 'Crud Panel', ()=>{
	let controller: TestController
	let notifySpy: jest.Mock<any, any>
	let renderResult: RenderResult
	let datasource: JsonDataSource

	beforeEach( async ()=>{
		datasource = new JsonDataSource({ ...mockData })
		Store.useDataSource( datasource )
		controller = new TestController()
		notifySpy = jest.fn()
		controller.onChange( notifySpy )

		renderResult = render(
			<CrudPanel 
				controller={ controller } 
				labels={ crudLabels }
			>
				<TestView />
				<TestCard />
			</CrudPanel>
		)
		await datasource.wait()
	})

	it( 'should show add button', ()=>{
		expect(
			screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel })
		).toBeInTheDocument()
	})
	
	it( 'should show existing documents', ()=>{
		const docs = screen.getByRole( 
			'heading', { name: crudLabels.documentsInCollectionCaption }
		).nextElementSibling as HTMLElement


		expect( within( docs ).getByText( 'Test prop 1' )	).toBeInTheDocument()
		expect( within( docs ).getByText( 'Test prop 2' )	).toBeInTheDocument()
		expect( docs.children.length ).toBe( 2 )
	})

	describe( 'Accepts children as functions', ()=>{
		beforeEach(() => {
			renderResult.rerender(
				<CrudPanel controller={ controller } labels={ crudLabels }>
					{ props => <TestView {...props}/> }
					{ props => <TestCard {...props}/> }
				</CrudPanel>
			)
		})

		it( 'should show add button', ()=>{
			expect(
				screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel })
			).toBeInTheDocument()
		})
		
		it( 'should show existing documents', ()=>{
			const docs = screen.getByRole( 
				'heading', { name: crudLabels.documentsInCollectionCaption }
			).nextElementSibling as HTMLElement
	
	
			expect( within( docs ).getByText( 'Test prop 1' )	).toBeInTheDocument()
			expect( within( docs ).getByText( 'Test prop 2' )	).toBeInTheDocument()
			expect( docs.children.length ).toBe( 2 )

			expect( screen.getAllByRole( 'button', { name: editButtonLabel })[0] ).toBeInTheDocument()
			expect( screen.getAllByRole( 'button', { name: deleteButtonLabel })[0] ).toBeInTheDocument()
		})
		
	})

	describe( 'Working with TestView', ()=> {
		
		it( 'should create an empty document view on add new document button click', ()=>{
			userEvent.click( screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel } ) )

			expect( screen.getByRole( 'heading', { name: viewHeader }) ).toBeInTheDocument()
			expect( 
				screen.getByPlaceholderText( testViewPlaceholder ) 
			).toHaveDisplayValue('')
		})

		it( 'should show detail view with document data on edit button click', ()=>{
			const testDoc = mockData.Test.test1
			const editButton = screen.getAllByRole( 'button', { name: editButtonLabel } )
			userEvent.click( editButton[0] )

			expect( screen.getByRole( 'heading', { name: viewHeader }) ).toBeInTheDocument()
			expect( screen.getByDisplayValue( testDoc.testProp ) ).toBeInTheDocument()
		})

		it( 'should refresh document list on new document added', async ()=>{
			userEvent.click( screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel} ))

			const input = await screen.findByPlaceholderText( testViewPlaceholder ) as HTMLInputElement
			// fireEvent.change( input, { target: { value: 'New and fancy Application' }})
			userEvent.type( input, 'New and fancy Application') // does not work!!

			userEvent.click( screen.getByRole( 'button', { name: crudLabels.addButtonLabel } ) )
			const docs = screen.getByRole( 
				'heading', { name: crudLabels.documentsInCollectionCaption }
			).nextElementSibling as HTMLElement
			expect( 
				await within( docs ).findByText( 'New and fancy Application' )
			).toBeInTheDocument()
		})
	})

	describe( 'Working with detail card buttons', ()=> {

		it( 'should refresh document list on document edited', async ()=>{
			const editButton = screen.getAllByRole( 'button', { name: editButtonLabel } )
			userEvent.click( editButton[0] )

			const input = await screen.findByPlaceholderText( testViewPlaceholder )
			userEvent.paste( input, ' Edited' )
			userEvent.click( screen.getByRole( 'button', { name: crudLabels.updateButtonLabel } ) )
			await waitFor( ()=>expect( notifySpy ).toHaveBeenCalled() )

			const docs = screen.getByRole( 
				'heading', { name: crudLabels.documentsInCollectionCaption }
			).nextElementSibling as HTMLElement
			expect( 
				await within( docs ).findByText( 'Test prop 1 Edited' )
			).toBeInTheDocument()
		})

		it( 'should delete document and remove from the list', async ()=>{
			expect( screen.queryByText( 'Test prop 2' ) ).toBeInTheDocument()

			const deleteButton = screen.getAllByRole( 'button', { name: deleteButtonLabel } )
			userEvent.click( deleteButton[1] )
			await waitFor( ()=>expect( notifySpy ).toHaveBeenCalled() )

			expect( screen.queryByText( 'Test prop 2' ) ).not.toBeInTheDocument()
		})

	})

	describe( 'Layout behaviour', ()=>{
		const itemsView = ()=>screen.queryByRole( 'heading', { name: crudLabels.documentsInCollectionCaption } )
		const formView = ()=>screen.queryByRole( 'heading', { name: viewHeader } )
		const addButton = ()=>screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel } )
		const renderWith = async ( layout: Layout ) => {
			renderResult.rerender(
				<CrudPanel controller={ controller } labels={ crudLabels } layout={ layout }>
					<TestView />
					{ ( props: CrudCardProps<Test> ) => (
							<div>
								<p>{ props.document.testProp }</p>
								<button onClick={ ()=>props.onSelect( props.document ) }>
									{ editButtonLabel }
								</button>
								<button onClick={ ()=>props.onDelete( props.document ) }>
									{ deleteButtonLabel }
								</button>
							</div>  
					)}
				</CrudPanel>
			)
		}

		it( 'should show always collection items when default layout', ()=>{
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).not.toBeInTheDocument()

			userEvent.click( addButton() )

			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

		it( 'should show always collection items when layout set to itemsAlways', ()=>{
			renderWith( 'itemsAlways' )
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).not.toBeInTheDocument()

			userEvent.click( addButton() )

			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

		it( 'should show always form view and items view when layout set to formAndItems', ()=>{
			renderWith( 'formAndItems' )
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

		it( 'should alternate from form view to items view but not both when layout set to formOrItems', ()=>{
			renderWith( 'formOrItems' )
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).not.toBeInTheDocument()

			userEvent.click( addButton() )

			expect( itemsView() ).not.toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

	})

	describe( 'Labels', ()=>{
		it( 'should allow to pass labels as a function', async ()=>{
			const labels = ( controller: CrudController<Test> ) => Object.entries( crudLabels )
			.reduce( ( prev, [ key, label ] ) => {
				prev[ key ] = `${ label } ${ controller.createDocument().className }`
				return prev
			},{}) as CrudPanelLabels
			
			renderResult.rerender(
				<CrudPanel controller={ controller } labels={ labels }>
					<TestView />
					{ ( props: CrudCardProps<Test> ) => (
						<div>
								<p>{ props.document.testProp }</p>
								<button onClick={ ()=>props.onSelect( props.document ) }>
									{ editButtonLabel }
								</button>
								<button onClick={ ()=>props.onDelete( props.document ) }>
									{ deleteButtonLabel }
								</button>
							</div>  
					)}
				</CrudPanel>
			)
			
			const documentClassName = controller.createDocument().className

			expect( 
				screen.getByText( `${ crudLabels.addNewDocumentLabel } ${ documentClassName }` ) 
			).toBeInTheDocument()
			expect( 
				screen.getByText( `${ crudLabels.documentsInCollectionCaption } ${ documentClassName }` ) 
			).toBeInTheDocument()
		})
	})
})
