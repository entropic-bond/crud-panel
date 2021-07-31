import { Callback, Persistent, Model, Observable } from 'entropic-bond'
type ControllerFactory = ( document: Persistent ) => CrudController<Persistent>

export interface CrudControllerEvent<T extends Persistent> {
	documentChanged?: T
	documentCollection?: T[]
}

export abstract class CrudController<T extends Persistent> {
	constructor( document: T ) {
		this._document = document
		this._onChange = new Observable<CrudControllerEvent<T>>()
	}

	protected abstract getModel(): Model<T> 

	static registerController( documentName: string, construct: ControllerConstructor ) {
		this._factories[ documentName ] = ( document: Persistent ) => {
			return new construct( document )
		}
	}

	static createController( document: Persistent ) {
		if ( !this._factories[ document.className ] ) throw new Error( `You should register ${ document.className } controller prior to use in the CRUD system`)
		const factory = this._factories[ document.className ]
		return factory( document )
	}
	
	onChange( observer: Callback<CrudControllerEvent<T>> ) {
		return this._onChange.subscribe( observer )
	}
	
	createDocument() {
		this._document = Persistent.createInstance( this.document.className ) as T
		this._onChange.notify({ documentChanged: this._document })
		return this._document
	}

	setDocument( value: T ) {
		if ( this._document != value ) {
			this._document = value
			this._onChange.notify({ documentChanged: value })
		}
		return this
	}
	
	get document(): T {
		return this._document
	}
	
	async storeDocument( document: T ) {
		await this.model.save( document )

		this._document = document

		this._onChange.notify({
			documentChanged: this._document !== document ? document : undefined,
			documentCollection: await this.getDocumentCollection()
		})
	}

	async deleteDocument( document: T ) {
		await this.model.delete( document.id )

		this._onChange.notify({
			documentChanged: document,
			documentCollection: await this.getDocumentCollection()
		})
	}
		
	getDocumentCollection() {
		return this.model.find().get()
	}
	
	protected get model() {
		return this._model || ( this._model = this.getModel() )
	}
		
	private _onChange: Observable<CrudControllerEvent<T>>
	private _model: Model<T>
	private _document: T
	private static _factories: {[ documentName: string ]: ControllerFactory } = {}
}

type ControllerConstructor = new ( document: Persistent ) => CrudController<Persistent>

/**
 * Decorator to associate this controller with the document type that it manages.
 * This will allow to create a controller from a given document automatically.
 * 
 * @param documentTypeName the document type name that this controller is 
 * dessigned for.
 */
export function controllerFor( documentTypeName: string ) {
	return function( constructor: ControllerConstructor ) {
		CrudController.registerController( documentTypeName, constructor )
	}
}
