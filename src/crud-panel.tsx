import { EntropicComponent, snakeCase, Unsubscriber } from 'entropic-bond'
import React, { cloneElement, Component, ReactElement } from 'react'
import { CrudController } from './crud-controller'

enum Mode { normal, add, edit }

export interface CrudCardProps<T extends EntropicComponent> {
	document: T
	onSelect?: ( document: T ) => void
	onDelete?: ( document: T ) => void
}

export interface CrudContentViewProps<T extends EntropicComponent> {
	controller: CrudController<T>
	submitButtonCaption: string
	onSubmit: ( document: T ) => void
	onCancel: ()=>void
}

export interface CrudPanelLabels {
	addNewDocumentLabel: string
	addButtonLabel: string
	updateButtonLabel: string
	singularDocumentInCollectionCaption?: string
	documentsInCollectionCaption: string
	noDocumentsFoundLabel: string
}

export type Layout = 'formOrItems' | 'itemsAlways' | 'formAndItems'

interface CrudPanelState<T extends EntropicComponent> {
	documents: T[] | readonly T[]
	mode: Mode
}

interface CrudPanelProps<T extends EntropicComponent> {
	controller: CrudController<T>	
	labels: CrudPanelLabels | ( ( controller: CrudController<T> ) => CrudPanelLabels )
	layout?: Layout
	children: [
		( ( props: CrudContentViewProps<T> ) => ReactElement ) | ReactElement<CrudContentViewProps<T>>,
		( ( props: CrudCardProps<T> ) => ReactElement ) | ReactElement<CrudCardProps<T>>
	]
	className?: string
	cardAddButton?: boolean | JSX.Element
	header?: string | JSX.Element
	footer?: string | JSX.Element
}

export class CrudPanel<T extends EntropicComponent> extends Component<CrudPanelProps<T>, CrudPanelState<T>> {

	constructor( props: CrudPanelProps<T> ) {
		super( props )

		this.state = {
			documents: [],
			mode: Mode.normal,
		}
	}

	async componentDidMount() {
		const { controller } = this.props

		this.unsubscriber = controller.onChange( event => {
			if ( event.documentCollection ) {
				this.setState({
					documents: event.documentCollection
				})
			}
			else this.setState({})
		})

		this.setState({
			documents: await controller.documentCollection()
		})
	}

	componentWillUnmount() {
		this.unsubscriber()
	}

	private newDocument() {
		this.props.controller.newDocument()

		this.setState({
			mode: Mode.add,
		})
	}

	private editDocument( document: T ) {
		this.props.controller.setDocument( document )

		this.setState({
			mode: Mode.edit
		})
	}

	private async storeDocument( document: T ) {
		const { controller, layout } = this.props
		controller.setDocument( document )
		await controller.storeDocument()

		if ( layout === 'formAndItems' ) {
			this.newDocument()
		}
		else {
			this.setState({
				mode: Mode.normal,
			})
		}
	}

	private invokeContentViewChild( labels : CrudPanelLabels ) {
		const { children, layout, controller } = this.props
		const { mode } = this.state
		const closeOnCancel = layout !== 'formAndItems'
		if ( !controller.document ) return

		const props: CrudContentViewProps<T> = {
			controller: controller,
			submitButtonCaption: mode==Mode.edit? labels?.updateButtonLabel : labels?.addButtonLabel,
			onSubmit: ( document: T ) => this.storeDocument( document ),
			onCancel: closeOnCancel
				? ()=>this.setState({ mode: Mode.normal })
				: ()=>this.newDocument(),
		}

		if ( typeof children[0] === 'function' ) {
			return cloneElement( children[0] (props), { key: controller.document.id })
		}
		else {
			return cloneElement( children[0], { key: controller.document.id, ...props })	
		}		
	}

	private invokeDetailViewChild( document: T ) {
		const { children, controller } = this.props

		const props: CrudCardProps<T> = {
			document,
			onSelect: (document: T) => this.editDocument( document ),
			onDelete: (document: T) => controller.setDocument( document ).deleteDocument()
		}

		if ( typeof children[1] === 'function' ) {
			return cloneElement( children[1]( props ), { key: document.id } )
		}
		else {
			return cloneElement( children[1], { key: document.id, ...props } )
		}
	}

	render() {
		const { mode, documents } = this.state
		const { className, cardAddButton, controller } = this.props
		const docClassName = snakeCase( controller.document?.className )
		let labels = this.props.labels || {} as CrudPanelLabels
		const layout = this.props.layout || 'itemsAlways'

		if ( typeof labels === 'function' ) labels = labels( controller )

		const { addNewDocumentLabel, singularDocumentInCollectionCaption, documentsInCollectionCaption, noDocumentsFoundLabel } = labels

		return (
			<div className={`crud-panel ${ docClassName } ${ className || '' }`}>

				{ mode === Mode.normal && layout !== 'formAndItems' && !cardAddButton &&

					<button onClick={ ()=> this.newDocument() }>
						{	addNewDocumentLabel	}
					</button>

				}

				{ ( layout === 'formAndItems' || mode === Mode.add || mode === Mode.edit ) &&

					<div className="content-panel">
						{
							this.invokeContentViewChild( labels )
						}
					</div>
				
				}

				{ ( layout==='itemsAlways' || layout === 'formAndItems'	|| mode === Mode.normal ) &&

					<div className="collection-panel">
						{ documents.length > 0 &&
							<h3>
								{ documents.length > 1
									? documentsInCollectionCaption 
									: singularDocumentInCollectionCaption || documentsInCollectionCaption
								}
							</h3>
						}

						<div className="documents">
							{ cardAddButton &&
								<div className="crud-card card-add-button clickable" 
									onClick={ ()=> this.newDocument() }
								>
									<div className="button-element">{	cardAddButton }</div>
									<div className="add-label">{	addNewDocumentLabel	}</div>
								</div>
							}
							{ documents.length
								? documents.map( document => this.invokeDetailViewChild( document ) )
								: <p>{ noDocumentsFoundLabel }</p>
							}
						</div>
					</div>
				
				}
			</div>
		)
	}

	private unsubscriber: Unsubscriber
}
