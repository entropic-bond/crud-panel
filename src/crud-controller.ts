import { Callback, Persistent, Model, Observable } from 'entropic-bond'

interface ProgressStage {
	name: string
	progress: number
	total: number
}

export interface ProgressEvent {
	stages: {
		[stageId: string]: ProgressStage
	}
	overallProgress: number
}

export interface CrudControllerEvent<T extends Persistent> {
	documentChanged?: T
	documentCollection?: T[]
}

export abstract class CrudController<T extends Persistent> {
	constructor( document: T ) {
		this._document = document
		this._onChange = new Observable<CrudControllerEvent<T>>()
		this._onProgress = new Observable<ProgressEvent>()
	}

	protected abstract getModel(): Model<T> 
	abstract allRequiredPropertiesFilled(): boolean
	
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

		this.notifyProgress( 'storeMainDocument', {
			name: 'Store main document',
			progress: 0.2,
			total: 1
		})

		await this.model.save( document )
		this._document = document

		this.notifyProgress( 'storeMainDocument', {
			name: 'Store main document',
			progress: 1,
			total: 1
		})
		this.resetProgress()

		this._onChange.notify({
			documentChanged: this._document !== document ? document : undefined,
			documentCollection: await this.getDocumentCollection()
		})
	}

	async deleteDocument( document: T ) {
		this.notifyProgress( 'deleteMainDocument', {
			name: 'Delete main document',
			progress: 0.2,
			total: 1
		})

		await this.model.delete( document.id )

		this.notifyProgress( 'deleteMainDocument', {
			name: 'Delete main document',
			progress: 1,
			total: 1
		})
		this.resetProgress()

		this._onChange.notify({
			documentChanged: document,
			documentCollection: await this.getDocumentCollection()
		})
	}
		
	getDocumentCollection() {
		return this.model.find().get()
	}

	onProgress( observer: Callback<ProgressEvent> ) {
		return this._onProgress.subscribe( observer )
	}

	protected notifyProgress( stageId: string, progress: ProgressStage ) {
		this._progressStage[ stageId ] = progress

		let overallProgress = Object.values( this._progressStage ).reduce( (prev, stage, _i, arr )=>{
			return prev + stage.progress / stage.total / arr.length
		}, 0)
		
		this._onProgress.notify({
			stages: { ...this._progressStage },
			overallProgress
		})
	}

	protected resetProgress() {
		this._progressStage = {}
	}
	
	protected get model() {
		return this._model || ( this._model = this.getModel() )
	}
		
	private _onChange: Observable<CrudControllerEvent<T>>
	private _model: Model<T>
	private _document: T
	private _progressStage: { [stageId: string]: ProgressStage } = {}
	private _onProgress: Observable<ProgressEvent>
}
