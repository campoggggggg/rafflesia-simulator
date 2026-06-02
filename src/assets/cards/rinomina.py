#!/usr/bin/env python3
"""
Rinomina i file PNG da 000.png-229.png a 001.png-230.png
Esegui nella cartella dove si trovano i file.
"""

import os
import sys

def rinomina(cartella="."):
    cartella = os.path.abspath(cartella)
    print(f"Cartella: {cartella}\n")

    # Costruisce la lista dei file da rinominare (000 → 229)
    operazioni = []
    for i in range(230):
        vecchio = os.path.join(cartella, f"{i:03d}.png")
        nuovo   = os.path.join(cartella, f"{i+1:03d}.png")
        if os.path.exists(vecchio):
            operazioni.append((vecchio, nuovo))
        else:
            print(f"  [WARN] Non trovato: {os.path.basename(vecchio)}")

    if not operazioni:
        print("Nessun file trovato. Controlla di essere nella cartella giusta.")
        sys.exit(1)

    # Anteprima
    print(f"File trovati: {len(operazioni)}")
    for v, n in operazioni[:5]:
        print(f"  {os.path.basename(v)}  →  {os.path.basename(n)}")
    if len(operazioni) > 5:
        print(f"  ... e altri {len(operazioni)-5} file")

    risposta = input("\nProcedo con la rinominazione? [s/N] ").strip().lower()
    if risposta != "s":
        print("Annullato.")
        sys.exit(0)

    # Rinomina in ordine INVERSO per evitare conflitti
    # (es. 229→230 prima di 228→229, ecc.)
    errori = 0
    for vecchio, nuovo in reversed(operazioni):
        try:
            os.rename(vecchio, nuovo)
            print(f"  OK  {os.path.basename(vecchio)}  →  {os.path.basename(nuovo)}")
        except Exception as e:
            print(f"  ERRORE  {os.path.basename(vecchio)}: {e}")
            errori += 1

    print(f"\nFatto! {len(operazioni)-errori}/{len(operazioni)} file rinominati.")
    if errori:
        print(f"  {errori} errori.")

if __name__ == "__main__":
    # Accetta un percorso opzionale come argomento
    cartella = sys.argv[1] if len(sys.argv) > 1 else "."
    rinomina(cartella)