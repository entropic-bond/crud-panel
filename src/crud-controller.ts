import { Callback, ClassPropNames, EntropicComponent, Model, Observable, PropChangeEvent, Unsubscriber, Query } from 'entropic-bond'
import { ProgressController, ProgressEvent } from './progress-controller'

type CrudControllerAction = 'saved' | 'deleted' | 'populated' | 'filterChange'

export interface CrudControllerEvent<T extends EntropicComponent> {
	documentProps?: PropChangeEvent<T> 
	documentChanged?: T
	documentCollection?: T[]
	action?: CrudControllerAction
	/** deprecated */	error?: Error 
}

type ValidatorFunction<V> = ( value: V ) => boolean 
type ValidatorCollection<T extends EntropicComponent> = {
	[ prop in ClassPropNames<T> ]: {
		func: ValidatorFunction<T[prop]>
		errorMessage?: string
	}
}

export abstract class CrudController<T extends EntropicComponent> {
	static readonly errorMessages = {
		missedDocument: 'No document to save',
	}

	constructor( document?: T ) {
		this.setDocument( document || this.createDocument() )
	}

	protected abstract createDocument(): T 
	protected abstract getModel(): Model<T> 
	
	allRequiredPropertiesFilled(): boolean {
		return this.nonFilledRequiredProperties.length <= 0
	}

	get nonFilledRequiredProperties(): ClassPropNames<T>[] {
		return this.requiredProperties.filter( prop => this.validateProp( prop ))
	}

	get requiredProperties(): ClassPropNames<T>[] {
		if ( !this.document ) throw new Error( CrudController.errorMessages.missedDocument )

		return this.document.getPersistentProperties()
			.filter( prop => this.document.isRequired( prop.name as ClassPropNames<T> ) )
			.map( prop => prop.name ) as ClassPropNames<T>[]
	}

	addValidator<P extends ClassPropNames<T>>( prop: P, validatorFn: ValidatorFunction<T[P]>, errorMessage?: string ) {
		this.validator[ prop ] = {
			func: validatorFn,
			errorMessage
		}
	}

	removeValidator( prop: ClassPropNames<T> ) {
		delete this.validator[ prop ]
	}

	failedValidationError( prop: ClassPropNames<T> ): string | undefined {
		return this.validator[ prop ]?.errorMessage
	}

	private validateProp( prop: ClassPropNames<T> ): boolean {
		if ( !this.document ) throw new Error( CrudController.errorMessages.missedDocument )

		const propVal = this.document[ prop ]

		if ( this.validator[ prop ] ) return !this.validator[ prop ].func( propVal )
		return !this.document.isPropValueValid( prop )
	}

	protected storeDoc(): Promise<void> {
		if ( !this.document ) throw new Error( CrudController.errorMessages.missedDocument )
		return this.model.save( this.document )
	}

	protected deleteDoc(): Promise<void> {
		if ( !this.document ) throw new Error( CrudController.errorMessages.missedDocument )
		return this.model.delete( this.document.id )
	}

	/**
	 * Override this method to customize the query used to retrieve the documents 
	 * in the documentCollection method. This is the default method used by 
	 * the documentCollection method. If the findDocs method is overridden and returns
	 * non undefined value, then this queryDocs method will not be used.
	 * 
	 * @param limit the maximum number of documents to retrieve
	 * @returns a query to retrieve the documents
	 * @see documentCollection
	 * @see findDocs
	 */
	protected queryDocs( limit?: number ): Query<T> {
		let query = this.model.find()

		if ( limit ) query = query.limit( limit )

		return query
	}

	/**
	 * Override this method to customize the query used to retrieve the documents 
	 * in the documentCollection method. The default method called by the 
	 * documentCollection method is the queryDocs method. If this findDocs method 
	 * returns a non undefined value, then this method will be used instead of the
	 * queryDocs method.
	 * 
	 * @param limit the maximum number of documents to retrieve
	 * @returns a query to retrieve the documents
	 * @see documentCollection
	 * @see queryDocs
	 */
	protected findDocs( limit?: number ): Promise<T[]> | undefined {
		return undefined
	}

	/**
	 * Sets a filter function to filter in memory the documents returned by the `documentCollection` method.
	 * 
	 * @param filter the filter function
	 * @returns the controller itself
	 */
	async setFilter( filter: ( document: T ) => boolean ) {
		this._filter = filter
		this.onChangeHdl.notify({ action: 'filterChange' })
		return this
	}

	/**
	 * Removes the filter function set by the `setFilter` method.
	 * @returns the controller itself
	 */
	resetFilter() {
		this._filter = undefined
		this.onChangeHdl.notify({ action: 'filterChange' })
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
		let found: T[] = []
		
		try {
			this.progressController.notifyBusy( true, progressStage )
			const docPromise = this.findDocs( limit )
			if ( docPromise ) found = await docPromise
			else found = await this.queryDocs( limit ).get()
		}
		catch( error ) {
			this.onChangeHdl.notify({ error: this.errorToError( error ) })
			this.onErrorHdl.notify( this.errorToError( error ))
			if ( this.throwOnError ) throw error
		}
		finally {
			this.progressController.notifyBusy( false, progressStage )
		}

		return found
	}

	filter( docs: T[] ): T[] {
		return docs.filter( doc => this._filter?.( doc ) ?? true )
	}

	onProgress( observer: Callback<ProgressEvent> ) {
		return this.progressController.onProgress( observer )
	}

	protected get model() {
		return this._model || ( this._model = this.getModel() )
	}

	setDocument( value: T ): this {
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
	private _document!: T
	private unsubscribeDocument: Unsubscriber | undefined
	private _filter: (( document: T ) => boolean ) | undefined
	private validator = {} as ValidatorCollection<T>
}
