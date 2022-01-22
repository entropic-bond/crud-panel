import { Callback, Persistent, Model, Observable } from 'entropic-bond'
import { ProgressController, ProgressEvent } from './progress-controller'

export interface CrudControllerEvent<T extends Persistent> {
	documentChanged?: T
	documentCollection?: T[]
}

export abstract class CrudController<T extends Persistent> {

	abstract allRequiredPropertiesFilled(): boolean
	abstract createDocument(): T 
	protected abstract getModel(): Model<T> 
	
	onChange( observer: Callback<CrudControllerEvent<T>> ) {
		return this._onChange.subscribe( observer )
	}

	async storeDocument( document: T ) {
		const progressStage = 'Saving main document'

		try {
			this._progressController.notifyBusy( true, progressStage )
			await this.model.save( document )

			this._onChange.notify({
				documentCollection: await this.getDocumentCollection()
			})
		}
		finally {
			this._progressController.notifyBusy( false, progressStage )
		}
	}

	async deleteDocument( document: T ) {
		const progressStage = 'Delete main document'
		try {
			this._progressController.notifyBusy( true, progressStage )
			await this.model.delete( document.id )

			this._onChange.notify({
				documentCollection: await this.getDocumentCollection()
			})
		}
		finally {
			this._progressController.notifyBusy( false, progressStage )
		}
	}
		
	async getDocumentCollection() {
		const progressStage = 'Retrieving document collection'

		try {
			this._progressController.notifyBusy( true, progressStage )
			var collection = await this.model.find().get()
		}
		finally {
			this._progressController.notifyBusy( false, progressStage )
		}

		return collection
	}

	onProgress( observer: Callback<ProgressEvent> ) {
		return this._progressController.onProgress( observer )
	}

	protected get model() {
		return this._model || ( this._model = this.getModel() )
	}
		
	private _onChange: Observable<CrudControllerEvent<T>> = new Observable<CrudControllerEvent<T>>()
	private _model: Model<T>
	private _progressController: ProgressController = new ProgressController()
}
