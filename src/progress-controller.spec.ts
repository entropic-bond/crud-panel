import { ProgressController, ProgressEvent } from './progress-controller'

describe( 'Progress Controller', ()=>{
	let observer: jest.Mock
	let controller: ProgressController

	beforeEach(()=>{
		observer = jest.fn()
		controller = new ProgressController()
		controller.onProgress( observer )
	})

	describe( 'Single stage', ()=>{
		it( 'should notify on push stage', ()=>{
			const stage = { name: 'test stage', progress: 0, total: 1 }
			controller.pushStage( stage )
	
			expect( observer ).toHaveBeenCalledWith({
				busy: true,
				overallProgress: 0,
				stages: { 'test stage': stage } 
			} as ProgressEvent )
		})
	
		it( 'should advance progress', ()=>{
			const stage = { name: 'test stage', progress: 0, total: 1 }
			
			controller.pushStage( stage )
			stage.progress = 0.5
			controller.pushStage( stage )
	
			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0.5,
				stages: { 'test stage': stage }
			} as ProgressEvent )
		})

		it( 'should notify not busy on completion', ()=>{
			const stage = { name: 'test stage', progress: 0, total: 1 }
			
			controller.pushStage( stage )
			stage.progress = 0.5
			controller.pushStage( stage )
			stage.progress = 1
			controller.pushStage( stage )
	
			expect( observer ).toHaveBeenLastCalledWith({
				busy: false,
				overallProgress: 1,
				stages: { 'test stage': stage }
			} as ProgressEvent )
		})

		it( 'should notify only new stages after completion', ()=>{
			const stage = { name: 'test stage', progress: 1, total: 1 }
			controller.pushStage( stage )
			expect( observer ).toHaveBeenLastCalledWith( expect.objectContaining({ busy: false }))

			controller.pushStage({ name: 'new operation stage', progress:0, total: 1 })

			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0,
				stages: { 'new operation stage': expect.anything() }
			} as ProgressEvent )
		})
		
		it( 'should accept ratios different from 1', ()=>{
			const stage = { name: 'test stage', progress: 30, total: 100 }
			controller.pushStage( stage )
	
			expect( observer ).toHaveBeenCalledWith({
				busy: true,
				overallProgress: 0.3,
				stages: { 'test stage': stage } 
			} as ProgressEvent )
		})
		
	})

	describe( 'Multiple stages', ()=>{
		it( 'should accumulate subsequent pushed stages', ()=>{
			const stage1 = { name: 'test stage1', progress: 0, total: 1 }
			const stage2 = { name: 'test stage2', progress: 0, total: 1 }
	
			controller.pushStage( stage1 )
			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0,
				stages: { 'test stage1': stage1 }
			} as ProgressEvent )
	
			controller.pushStage( stage2 )
			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0,
				stages: {
					'test stage1': stage1, 
					'test stage2': stage2 
				}
			} as ProgressEvent )
		})

		it( 'should calculate overall progress from multiple stages', ()=>{
			const stage1 = { name: 'test stage1', progress: 0.1, total: 1 }
			const stage2 = { name: 'test stage2', progress: 0.5, total: 1 }
	
			controller.pushStage( stage1 )
			controller.pushStage( stage2 )
			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0.3,
				stages: expect.anything()
			})
		})
		
		it( 'should calculate overall progress from multiple stages with some stages finished', ()=>{
			const stage1 = { name: 'test stage1', progress: 0.1, total: 1 }
			const stage2 = { name: 'test stage2', progress: 0.5, total: 1 }
	
			controller.pushStage( stage1 )
			controller.pushStage( stage2 )
			stage1.progress = 1
			controller.pushStage( stage1 )

			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0.75,
				stages: expect.anything()
			})
		})
		
		it( 'should notify not busy when all stages finished', ()=>{
			const stage1 = { name: 'test stage1', progress: 0.1, total: 1 }
			const stage2 = { name: 'test stage2', progress: 0.5, total: 1 }
	
			controller.pushStage( stage1 )
			controller.pushStage( stage2 )
			stage1.progress = 1
			controller.pushStage( stage1 )
			stage2.progress = 1
			controller.pushStage( stage2 )

			expect( observer ).toHaveBeenLastCalledWith({
				busy: false,
				overallProgress: 1,
				stages: expect.anything()
			})
		})
		
		it( 'should accept progress with different ratios', ()=>{
			const stage1 = { name: 'test stage1', progress: 0.1, total: 1 }
			const stage2 = { name: 'test stage2', progress: 50, total: 100 }
	
			controller.pushStage( stage1 )
			controller.pushStage( stage2 )
			expect( observer ).toHaveBeenLastCalledWith({
				busy: true,
				overallProgress: 0.3,
				stages: expect.anything()
			})
	})
		
	})
})