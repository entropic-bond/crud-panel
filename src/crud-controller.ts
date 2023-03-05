import { Callback, EntropicComponent, Model, Observable, PropChangeEvent, Unsubscriber } from 'entropic-bond'
import { ProgressController, ProgressEvent } from './progress-controller'

type CrudControllerAction = 'saved' | 'deleted' | 'populated'

export interface CrudControllerEvent<T extends EntropicComponent> {
	documentProps?: PropChangeEvent<T> 
	documentChanged?: T
	documentCollection?: T[]
	action?: CrudControllerAction
	error?: Error
}

export abstract class CrudController<T extends EntropicComponent> {
	constructor( document?: T ) {
		this.setDocument( document || this.createDocument() )
	}

	abstract allRequiredPropertiesFilled(): boolean
	protected abstract createDocument(): T 
	protected abstract getModel(): Model<T> 
	
	protected storeDoc(): Promise<void> {
		return this.model.save( this.document )
	}

	protected deleteDoc(): Promise<void> {
		return this.model.delete( this.document.id )
	}

	protected findDocs( limit: number ): Promise<T[]> {
		return this.model.find().limit( limit ).get()
	}
	
	onChange( observer: Callback<CrudControllerEvent<T>> ) {
		return this.onChangeHdl.subscribe( observer )
	}

	protected notifyChange<U extends CrudControllerEvent<T>>( event: U ) {
		this.onChangeHdl.notify( event )
	}

	newDocument() {
		return this.setDocument( this.createDocument() )
	}

	async storeDocument() {
		const progressStage = 'Saving main document'

		try {
			this.progressController.notifyBusy( true, progressStage )
			await this.storeDoc()

			this.onChangeHdl.notify({
				documentCollection: await this.documentCollection(),
				action: 'saved'
			})
		}
		catch( error ) {
			this.onChangeHdl.notify({ error: this.errorToError( error ) })
		}
		finally {
			this.progressController.notifyBusy( false, progressStage )
		}
	}

	async deleteDocument() {
		const progressStage = 'Delete main document'
		try {
			this.progressController.notifyBusy( true, progressStage )
			await this.deleteDoc()

			this.onChangeHdl.notify({
				documentCollection: await this.documentCollection(),
				action: 'deleted'
			})
		}
		catch( error ) {
			this.onChangeHdl.notify({ error: this.errorToError( error ) })
		}
		finally {
			this.progressController.notifyBusy( false, progressStage )
		}
	}
		
	async documentCollection( limit?: number ): Promise<T[]> {
		const progressStage = 'Retrieving document collection'

		try {
			this.progressController.notifyBusy( true, progressStage )
			var found = await this.findDocs( limit )
		}
		catch( error ) {
			this.onChangeHdl.notify({ error: this.errorToError( error ) })
		}
		finally {
			this.progressController.notifyBusy( false, progressStage )
		}

		return found
	}

	onProgress( observer: Callback<ProgressEvent> ) {
		return this.progressController.onProgress( observer )
	}

	protected get model() {
		return this._model || ( this._model = this.getModel() )
	}

	setDocument( value: T ): CrudController<T> {
		if ( this._document !== value ) {

			if ( this.unsubscribeDocument ) this.unsubscribeDocument()

			if ( value ) {
				this.unsubscribeDocument = value.onChange( e => this.onChangeHdl.notify({ documentProps: e } ) )
			}

			this._document = value
			this.onChangeHdl.notify({ documentChanged: this._document })
		}

		return this
	}

	set document( value: T ) {
		this.setDocument( value )
	}
	
	get document(): T {
		return this._document
	}

	protected errorToError( error: any ): Error {
		if ( error instanceof Error ) return error
		if ( typeof error === 'string' ) return new Error( error )
		if ( 'code' in error ) return new Error( error.code )
		if ( 'message' in error ) return new Error( error.error )
		return new Error( JSON.stringify( error ) )
	}

	protected progressController: ProgressController = new ProgressController()
	protected onChangeHdl: Observable<CrudControllerEvent<T>> = new Observable<CrudControllerEvent<T>>()
	private _model: Model<T>
	private _document: T
	private unsubscribeDocument: Unsubscriber
}
