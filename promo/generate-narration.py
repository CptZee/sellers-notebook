import asyncio, json, sys
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'audio'
OUT.mkdir(exist_ok=True)

async def main():
    scripts = json.loads((ROOT / 'narration-scripts.json').read_text(encoding='utf-8'))
    for name, text in scripts.items():
        if '--operations-only' in sys.argv and name != 'operations':
            continue
        voice = edge_tts.Communicate(text, 'en-US-JennyNeural', rate='+0%', pitch='-2Hz', boundary='WordBoundary')
        words = []
        with (OUT / f'{name}-voice.mp3').open('wb') as audio:
            async for item in voice.stream():
                if item['type'] == 'audio':
                    audio.write(item['data'])
                elif item['type'] == 'WordBoundary':
                    words.append({k:item[k] for k in ['offset','duration','text']})
        (OUT / f'{name}-words.json').write_text(json.dumps(words, indent=2), encoding='utf-8')
        print(f'{name}: {len(words)} words; last word ends at {(words[-1]["offset"] + words[-1]["duration"])/1e7:.2f}s', flush=True)

asyncio.run(main())
