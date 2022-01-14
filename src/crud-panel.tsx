import { Persistent, snakeCase, Unsubscriber } from 'entropic-bond'
import React, { cloneElement, Component, ReactElement } from 'react'
import { CrudController } from './crud-controller'

enum Mode { normal, add, edit }

export interface CrudCardProps<T extends Persistent> {
	document: T
	onSelect?: ( document: T ) => void
	onDelete?: ( document: T ) => void
}

type ProgressBarElement = ( progress: number ) => JSX.Element

export interface CrudContentViewProps<T extends Persistent> {
	document: T
	submitButtonCaption: string
	onSubmit: ( document: T ) => void
	onCancel: ()=>void
}

export interface CrudPanelLabels {
	addNewDocumentLabel: string
	addButtonLabel: string
	updateButtonLabel: string
	documentsInCollectionCaption: string
	noDocumentsFoundLabel: string
}

export type Layout = 'formOrItems' | 'itemsAlways' | 'formAndItems'

interface CrudPanelState<T extends Persistent> {
	documents: T[]
	mode: Mode
	progress: number
	document: T
}

interface CrudPanelProps<T extends Persistent> {
	controller: CrudController<T>	
	labels: CrudPanelLabels | ( ( controller: CrudController<T> ) => CrudPanelLabels )
	layout?: Layout
	children: [
		( ( props: CrudContentViewProps<T> ) => ReactElement ) | ReactElement<CrudContentViewProps<T>>,
		( ( props: CrudCardProps<T> ) => ReactElement ) | ReactElement<CrudCardProps<T>>
	]
	className?: string
	cardAddButton?: boolean | JSX.Element
	progressBar?: ProgressBarElement
	header?: string | JSX.Element
	footer?: string | JSX.Element
}

export class CrudPanel<T extends Persistent> extends Component<CrudPanelProps<T>, CrudPanelState<T>> {

	constructor( props: CrudPanelProps<T> ) {
		super( props )

		this.state = {
			documents: [],
			mode: Mode.normal,
			progress: 0,
			document: props.controller.createDocument()
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

		this.progressUnsubscriber = controller.onProgress( 
			e => this.setState({ progress: e.overallProgress})
		)

		this.setState({
			documents: await controller.getDocumentCollection()
		})
	}

	componentWillUnmount() {
		this.unsubscriber()
		this.progressUnsubscriber()
	}

	private newDocument() {
		const { controller } = this.props
		
		this.setState({
			mode: Mode.add,
			document: controller.createDocument()
		})
	}

	private editDocument( document: T ) {
		this.setState({
			document,
			mode: Mode.edit
		})
	}

	private async storeDocument( document: T ) {
		const { controller, layout } = this.props
		
		await controller.storeDocument( document )

		if ( layout === 'formAndItems' ) {
			this.newDocument()
		}
		else {
			this.setState({
				mode: Mode.normal,
				progress: 0
			})
		}
	}

	private invokeContentViewChild( labels : CrudPanelLabels ) {
		const { children, layout } = this.props
		const { mode, document } = this.state
		const { addButtonLabel, updateButtonLabel } = labels
		const closeOnCancel = layout !== 'formAndItems'
		if ( !document ) return

		const props: CrudContentViewProps<T> = {
			document,
			submitButtonCaption: mode==Mode.edit? updateButtonLabel : addButtonLabel,
			onSubmit: ( document: T ) => this.storeDocument( document ),
			onCancel: closeOnCancel
				? ()=>this.setState({ mode: Mode.normal })
				: ()=>this.newDocument(),
		}

		if ( typeof children[0] === 'function' ) {
			return cloneElement( children[0] (props), { key: document.id })
		}
		else {
			return cloneElement( children[0], { key: document.id, ...props })	
		}		
	}

	private invokeDetailViewChild( document: T ) {
		const { children, controller } = this.props

		const props: CrudCardProps<T> = {
			document,
			onSelect: (document: T) => this.editDocument( document ),
			onDelete: (document: T) => controller.deleteDocument( document )
		}

		if ( typeof children[1] === 'function' ) {
			return cloneElement( children[1]( props ), { key: document.id } )
		}
		else {
			return cloneElement( children[1], { key: document.id, ...props } )
		}
	}

	render() {
		const { mode, documents, progress, document } = this.state
		const { controller, className, cardAddButton, progressBar } = this.props
		const docClassName = snakeCase( document?.className )
		let labels = this.props.labels
		const layout = this.props.layout || 'itemsAlways'

		if ( typeof labels === 'function' ) labels = labels( controller )

		const { addNewDocumentLabel, documentsInCollectionCaption, noDocumentsFoundLabel } = labels

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
						{ progress>0 && progressBar?.( progress * 100 ) }
					</div>
				
				}

				{ ( layout==='itemsAlways' || layout === 'formAndItems'	|| mode === Mode.normal ) &&

					<div className="collection-panel">
						<h3>{ documentsInCollectionCaption }</h3>

						<div className="documents">
							{ cardAddButton &&
								<div className="card-add-button clickable" 
									onClick={ ()=> this.newDocument() }
								>
									{	cardAddButton }
									{	addNewDocumentLabel	}
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
	private progressUnsubscriber: Unsubscriber
}
