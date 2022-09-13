import { AfterViewInit, Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import * as Tone from 'tone';

// https://jsfiddle.net/shaiui/0z8x352n/
// https://github.com/tambien/Piano
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {

  private synth: any;
  notes: Array<Note>;
  fullscreen = false;
  currentNoteByPointer = new Map<number, string>();

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
  }

  ngAfterViewInit(): void {
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
      this.synth.triggerAttackRelease(under.id, "16n");
    }
  }

  pointerUp(event: PointerEvent) {
    this.currentNoteByPointer.delete(event.pointerId);
  }

  pointerMove(event: PointerEvent) {
    const prevNote = this.currentNoteByPointer.get(event.pointerId);
    if (prevNote) {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (under?.classList.contains('note')) {
        if (prevNote !== under.id) {
          this.synth.triggerAttackRelease(under.id, "16n");
          this.currentNoteByPointer.set(event.pointerId, under.id);
        }
      }
    }
  }

  noteDown(note: Note, event: MouseEvent) {
    /*if (!this.fullscreen) {
      document.documentElement.requestFullscreen();
      screen.orientation.lock('landscape');
      this.fullscreen = true;
    }*/
    const elt = document.getElementById(note.id);
    if (elt) {
      elt.style.background = note.isSharp ? 'black' : '#ccc';
    }
    this.synth.triggerAttackRelease(note.toPlay, "16n");
    event.stopPropagation();
  }

  noteUp(note: Note) {
    const elt = document.getElementById(note.id);
    if (elt) {
      elt.style.background = note.isSharp ? '#777' : '';
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