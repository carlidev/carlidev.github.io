import { AfterViewInit, Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import * as Tone from 'tone';

@Component({
  selector: 'app-piano',
  templateUrl: './piano.component.html',
  styleUrls: ['./piano.component.scss']
})
export class PianoComponent implements AfterViewInit {

  private synth: any;
  notes: Array<Note>;
  currentNoteByPointer = new Map<number, string>();
  pointersByNote = new Map<string, Set<number>>();

  @ViewChild('container', { static: true }) protected container!: ElementRef;

  constructor(private renderer: Renderer2) {
    this.synth = new Tone.Synth().toDestination();
    this.notes = [
      new Note('C', 4),
      new Note('D', 4),
      new Note('E', 4),
      new Note('F', 4),
      new Note('G', 4),
      new Note('A', 4),
      new Note('B', 4),
      /*new Note('C', 5),
      new Note('D', 5),
      new Note('E', 5),
      new Note('F', 5),
      new Note('G', 5),
      new Note('A', 5),
      new Note('B', 5)*/
    ];
    this.notes.forEach(note => {
      this.pointersByNote.set(note.id, new Set());
      if (note.sharp) {
        this.pointersByNote.set(note.sharp.id, new Set());
      }
    });
  }

  ngAfterViewInit(): void {
    document.documentElement.requestFullscreen();
    screen.orientation.lock('landscape').catch(() => { });
    this.renderer.listen(this.container.nativeElement, 'pointerdown', (event: PointerEvent) => {
      this.pointerDown(event);
    });
    this.renderer.listen(this.container.nativeElement, 'pointerup', (event: PointerEvent) => {
      this.pointerUp(event);
    });
    this.renderer.listen(this.container.nativeElement, 'pointermove', (event: PointerEvent) => {
      this.pointerMove(event);
    });
  }

  pointerDown(event: PointerEvent) {
    const under = document.elementFromPoint(event.clientX, event.clientY);
    if (under?.classList.contains('note')) {
      this.currentNoteByPointer.set(event.pointerId, under.id);
      this.playNote(under.id, event.pointerId);
    }
  }

  pointerUp(event: PointerEvent) {
    const noteId = this.currentNoteByPointer.get(event.pointerId);
    this.currentNoteByPointer.delete(event.pointerId);
    if (noteId) {
      this.stopNote(noteId, event.pointerId);
    }
  }

  pointerMove(event: PointerEvent) {
    const prevNoteId = this.currentNoteByPointer.get(event.pointerId);
    if (prevNoteId) {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (under?.classList.contains('note')) {
        if (prevNoteId !== under.id) {
          this.playNote(under.id, event.pointerId);
          this.currentNoteByPointer.set(event.pointerId, under.id);
          this.stopNote(prevNoteId, event.pointerId);
        }
      }
    }
  }

  playNote(noteId: string, pointerId: number) {
    this.synth.triggerAttackRelease(noteId, "16n");
    const pointers = this.pointersByNote.get(noteId)!;
    pointers.add(pointerId);
    const elt = document.getElementById(noteId);
    if (elt) {
      elt.style.background = 'black';
    }
  }

  stopNote(noteId: string, pointerId: number) {
    const pointers = this.pointersByNote.get(noteId)!;
    pointers.delete(pointerId);
    if (pointers.size <= 0) {
      const elt = document.getElementById(noteId);
      if (elt) {
        elt.style.background = '';
      }
    }
  }

}
export class Note {

  public sharp: Note | undefined;

  constructor(public letter: string, public octave: number, public isSharp = false) {
    if (this.hasSharp) {
      this.sharp = new Note(this.letter, this.octave, true);
    } else {
      this.sharp = undefined;
    }
  }

  public get hasSharp(): boolean {
    return this.letter !== 'E' && this.letter !== 'B' && ! this.isSharp;
  }

  public get toPlay(): string {
    return this.letter + (this.isSharp ? '#' : '') + this.octave;
  }

  public get id(): string {
    return this.toPlay;
  }
}