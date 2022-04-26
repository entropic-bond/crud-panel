import React, { Component } from 'react'
import { render, RenderResult, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JsonDataSource, Store } from 'entropic-bond'
import { CrudContentViewProps, CrudPanel, CrudPanelLabels, CrudCardProps, Layout } from './crud-panel'
import { CrudController } from './crud-controller'
import { Test, TestController } from './crud-controller.spec'

const crudLabels: CrudPanelLabels = {
	addNewDocumentLabel: 'Add new document',
	addButtonLabel: 'Add',
	updateButtonLabel: 'Update',
	documentsInCollectionCaption: 'Existing documents',
	singularDocumentInCollectionCaption: 'Existing document',
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

class TestView extends Component<Partial<CrudContentViewProps<Test>>> {
	componentDidMount(): void {
		const { controller } = this.props
		
		controller.onChange( e => {
			if ( e.documentProps ) this.setState( e.documentProps )
		})
	}

	render() {
		const { controller, onCancel, onSubmit, submitButtonCaption } = this.props
		const { document } = controller


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
		datasource = new JsonDataSource( JSON.parse( JSON.stringify( mockData )))
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
		// await datasource.wait()
		await screen.findByRole( 'heading' )
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
			userEvent.setup()
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
		
		it( 'should create an empty document view on add new document button click', async ()=>{
			await userEvent.click( screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel } ) )

			expect( screen.getByRole( 'heading', { name: viewHeader }) ).toBeInTheDocument()
			expect( 
				screen.getByPlaceholderText( testViewPlaceholder ) 
			).toHaveDisplayValue('')
		})

		it( 'should show detail view with document data on edit button click', async ()=>{
			const testDoc = mockData.Test.test1
			const editButton = screen.getAllByRole( 'button', { name: editButtonLabel } )
			await userEvent.click( editButton[0] )

			expect( screen.getByRole( 'heading', { name: viewHeader }) ).toBeInTheDocument()
			expect( screen.getByDisplayValue( testDoc.testProp ) ).toBeInTheDocument()
		})

		it( 'should refresh document list on new document added', async ()=>{
			await userEvent.click( screen.getByRole( 'button', { name: crudLabels.addNewDocumentLabel} ))

			const input = await screen.findByPlaceholderText( testViewPlaceholder ) as HTMLInputElement
			await userEvent.type( input, 'New and fancy Application') 

			await userEvent.click( screen.getByRole( 'button', { name: crudLabels.addButtonLabel } ) )
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
			await userEvent.click( editButton[0] )

			const input = await screen.findByPlaceholderText( testViewPlaceholder )
			await userEvent.click( input )
			await userEvent.paste( ' Edited' )
			await userEvent.click( screen.getByRole( 'button', { name: crudLabels.updateButtonLabel } ) )
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
			await userEvent.click( deleteButton[1] )
			await waitFor( ()=>expect( notifySpy ).toHaveBeenCalled() )

			await waitFor( 
				()=>expect( screen.queryByText( 'Test prop 2' ) ).not.toBeInTheDocument()
			)
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

		it( 'should show always collection items when default layout', async ()=>{
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).not.toBeInTheDocument()

			await userEvent.click( addButton() )

			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

		it( 'should show always collection items when layout set to itemsAlways', async ()=>{
			renderWith( 'itemsAlways' )
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).not.toBeInTheDocument()

			await userEvent.click( addButton() )

			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

		it( 'should show always form view and items view when layout set to formAndItems', ()=>{
			renderWith( 'formAndItems' )
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

		it( 'should alternate from form view to items view but not both when layout set to formOrItems', async ()=>{
			renderWith( 'formOrItems' )
			expect( itemsView() ).toBeInTheDocument()
			expect(	formView() ).not.toBeInTheDocument()

			await userEvent.click( addButton() )

			expect( itemsView() ).not.toBeInTheDocument()
			expect(	formView() ).toBeInTheDocument()
		})

	})

	describe( 'Labels', ()=>{
		it( 'should show singular when only one existing document', async () => {
			expect( screen.queryByText( 'Test prop 2' ) ).toBeInTheDocument()

			const deleteButton = screen.getAllByRole( 'button', { name: deleteButtonLabel } )
			await userEvent.click( deleteButton[ 1 ] )
			await waitFor( () => expect( notifySpy ).toHaveBeenCalled() )

			const heading = await screen.findByRole( 'heading', { name: crudLabels.singularDocumentInCollectionCaption } )
			expect( heading ).toBeInTheDocument()
		} )

		it( 'should show plural when only one existing document but empty singular caption', async () => {
			crudLabels.singularDocumentInCollectionCaption = undefined
			expect( screen.queryByText( 'Test prop 2' ) ).toBeInTheDocument()

			const deleteButton = screen.getAllByRole( 'button', { name: deleteButtonLabel } )
			userEvent.click( deleteButton[ 1 ] )
			await waitFor( () => expect( notifySpy ).toHaveBeenCalled() )

			const heading = screen.getByRole( 'heading', { name: crudLabels.documentsInCollectionCaption } )
			expect( heading ).toBeInTheDocument()
		} )

		it( 'should allow to pass labels as a function', async ()=>{
			const labels = ( controller: CrudController<Test> ) => Object.entries( crudLabels )
			.reduce( ( prev, [ key, label ] ) => {
				prev[ key ] = `${ label } ${ controller.document.className }`
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

		it( 'should not throw on undefined labels', ()=>{
			expect(
				()=>renderResult.rerender(
					<CrudPanel controller={ controller } labels={ undefined }>
						<TestView />
						<TestCard />
					</CrudPanel>
				)
			).not.toThrow()
		})
		
	})
})
