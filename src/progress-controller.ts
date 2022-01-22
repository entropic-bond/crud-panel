import { Callback, Observable } from 'entropic-bond'

interface ProgressStage {
	name: string
	progress: number
	total: number
}

interface ProgressStageCollection {
	[ stageName: string ]: ProgressStage
}

export interface ProgressEvent {
	busy: boolean
	stages: ProgressStageCollection
	overallProgress: number
}

export class ProgressController {
	notifyBusy( busy: boolean, name?: string ) {
		this.pushStage({
			name, progress: busy? 0 : 1, total: 1
		})
	}

	pushStage( stage: ProgressStage ) {
		this._stages[ stage.name ] = stage

		const overallProgress = Object.values( this._stages ).reduce( (prev, stage, _i, arr )=>{
			return prev + stage.progress / stage.total / arr.length
		}, 0)
		
		this._onProgress.notify({
			busy: overallProgress < 1,
			overallProgress,
			stages: this._stages
		})

		if ( overallProgress >= 1 ) this._stages = {}
	}

	onProgress( cb: Callback<ProgressEvent> ) {
		return this._onProgress.subscribe( cb )
	}

	private _stages: ProgressStageCollection = {}
	private _onProgress: Observable<ProgressEvent> = new Observable<ProgressEvent>()
}