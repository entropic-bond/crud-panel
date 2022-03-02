import { Callback, EntropicComponent, Model, Observable, PropChangeEvent, Unsubscriber } from 'entropic-bond'
import { ProgressController, ProgressEvent } from './progress-controller'

export interface CrudControllerEvent<T extends EntropicComponent> {
	documentProps?: PropChangeEvent<T> 
	documentChanged?: T
	documentCollection?: T[] | readonly T[]
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

	protected findDocs( limit: number ): Promise<T[] | readonly T[]> {
		return this.model.find().limit( limit ).get()
	}
	
	onChange( observer: Callback<CrudControllerEvent<T>> ) {
		return this.onChangeHdl.subscribe( observer )
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
				documentCollection: await this.documentCollection()
			})
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
				documentCollection: await this.documentCollection()
			})
		}
		finally {
			this.progressController.notifyBusy( false, progressStage )
		}
	}
		
	async documentCollection( limit?: number ): Promise<T[] | readonly T[]> {
		const progressStage = 'Retrieving document collection'

		try {
			this.progressController.notifyBusy( true, progressStage )
			var found = await this.findDocs( limit )
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
			this.unsubscribeDocument = value.onChange( e => this.onChangeHdl.notify({ documentProps: e } ) )
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

	protected progressController: ProgressController = new ProgressController()
	protected onChangeHdl: Observable<CrudControllerEvent<T>> = new Observable<CrudControllerEvent<T>>()
	private _model: Model<T>
	private _document: T
	private unsubscribeDocument: Unsubscriber
}
