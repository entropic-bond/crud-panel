import { Callback, EntropicComponent, Model, Observable, PropChangeEvent, Unsubscriber } from 'entropic-bond'
import { ProgressController, ProgressEvent } from './progress-controller'

type CrudControllerAction = 'saved' | 'deleted' | 'populated'

export interface CrudControllerEvent<T extends EntropicComponent> {
	documentProps?: PropChangeEvent<T> 
	documentChanged?: T
	documentCollection?: T[]
	action?: CrudControllerAction
	/** deprecated */	error?: Error 
}

export abstract class CrudController<T extends EntropicComponent> {
	static readonly errorMessages = {
		missedDocument: 'No document to save',
	}

	constructor( document?: T ) {
		this.setDocument( document || this.createDocument() )
	}

	abstract allRequiredPropertiesFilled(): boolean
	protected abstract createDocument(): T 
	protected abstract getModel(): Model<T> 
	
	protected storeDoc(): Promise<void> {
		if ( !this.document ) throw new Error( CrudController.errorMessages.missedDocument )
		return this.model.save( this.document )
	}

	protected deleteDoc(): Promise<void> {
		if ( !this.document ) throw new Error( CrudController.errorMessages.missedDocument )
		return this.model.delete( this.document.id )
	}

	protected async findDocs( limit?: number ): Promise<T[]> {
		let query = this.model.find()

		if ( limit ) query = query.limit( limit )

		return query.get()
	}

	/**
	 * Sets a filter function to filter in memory the documents returned by the `documentCollection` method.
	 * 
	 * @param filter the filter function
	 * @returns the controller itself
	 */
	async setFilter( filter: ( document: T ) => boolean ) {
		this._filter = filter
		this.onChangeHdl.notify({ documentCollection: await this.documentCollection() })
		return this
	}
	
	onChange( observer: Callback<CrudControllerEvent<T>> ) {
		return this.onChangeHdl.subscribe( observer )
	}

	/**
	 * Notifies the observer of any error that occurs during the execution of the controller.
	 * If there are no subscribers to this event, the error will be thrown.
	 * 
	 * @param observer 
	 * @returns the unsubscriber function
	 */
	onError( observer: Callback<Error> ) {
		return this.onErrorHdl.subscribe( observer )
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
			this.onErrorHdl.notify( this.errorToError( error ))
			if ( this.throwOnError ) throw error
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
			this.onErrorHdl.notify( this.errorToError( error ))
			if ( this.throwOnError ) throw error
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
			this.onErrorHdl.notify( this.errorToError( error ))
			if ( this.throwOnError ) throw error
		}
		finally {
			this.progressController.notifyBusy( false, progressStage )
		}


		if ( !this._filter ) return found!
		return found!.filter( doc => this._filter?.( doc ))
	}

	onProgress( observer: Callback<ProgressEvent> ) {
		return this.progressController.onProgress( observer )
	}

	protected get model() {
		return this._model || ( this._model = this.getModel() )
	}

	setDocument( value: T | undefined ): CrudController<T> {
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

	set document( value: T | undefined ) {
		this.setDocument( value )
	}
	
	get document(): T | undefined {
		return this._document
	}

	/**
	 * Use this method to throw an error in a controlled way.
	 * It will notify the subscribers of the `onError` event and throw the error 
	 * if there are no subscribers to the `onError` event.
	 * 
	 * @param error the error to throw
	 */
	protected managedThrow( error: Error | string | any ) {
		/* deprecated */ this.onChangeHdl.notify({ error: this.errorToError( error ) })
		this.onErrorHdl.notify( this.errorToError( error ))
		if ( this.throwOnError ) throw this.errorToError( error )
	}

	protected errorToError( error: any ): Error {
		if ( error instanceof Error ) return error
		if ( typeof error === 'string' ) return new Error( error )
		if ( 'code' in error ) return new Error( error.code )
		if ( 'message' in error ) return new Error( error.error )
		return new Error( JSON.stringify( error ) )
	}

	protected get throwOnError() {
		return this.onErrorHdl.subscribersCount === 0 
	}

	protected progressController: ProgressController = new ProgressController()
	protected onChangeHdl: Observable<CrudControllerEvent<T>> = new Observable<CrudControllerEvent<T>>()
	protected onErrorHdl: Observable<Error> = new Observable<Error>()
	private _model: Model<T> | undefined
	private _document: T | undefined
	private unsubscribeDocument: Unsubscriber | undefined
	private _filter: (( document: T ) => boolean ) | undefined
}
