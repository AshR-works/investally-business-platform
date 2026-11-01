"""Copie Excel du diagramme de Gantt : lit gantt/items.json (écrit par build.mjs) et produit ../GANTT-PROJET.xlsx.

    node docs/gantt/build.mjs && python docs/gantt/build-xlsx.py
"""
import json
import os
from datetime import date, timedelta

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, 'items.json'), encoding='utf8'))
iso = date.fromisoformat
today = iso(data['today'])
first, last = iso(data['first']), iso(data['last'])
STATE = {'done': 'Validé', 'wait': 'Terminé, validation en attente', 'plan': 'Prévu', 'ext': 'Échéance'}
FILL = {'done': '2F2C2A', 'wait': 'B3541E', 'plan': 'C9C4BE', 'ext': 'B3541E'}

wb = Workbook()
ws = wb.active
ws.title = 'Gantt'
head = ['Phase', 'Lot', 'Début', 'Fin', 'État', 'Étiquette']
FIXED = len(head)
days = [first + timedelta(d) for d in range((last - first).days + 1)]
ws.append(head + [d.strftime('%d/%m') for d in days])
for c in range(1, FIXED + 1):
    ws.cell(1, c).font = Font(bold=True)
for i, d in enumerate(days):
    cell = ws.cell(1, FIXED + 1 + i)
    cell.alignment = Alignment(text_rotation=90, horizontal='center')
    cell.font = Font(bold=True, size=8, color='C0392B' if d == today else '000000')
    ws.column_dimensions[get_column_letter(FIXED + 1 + i)].width = 2.6
for letter, width in zip('ABCDEF', (30, 58, 12, 12, 30, 20)):
    ws.column_dimensions[letter].width = width

row = 2
for group in data['items']:
    for item in group['rows']:
        start, end = iso(item['start']), iso(item['end'])
        ws.append([group['phase'], item['name'], start, end, STATE[item['state']], item.get('tag', '')])
        ws.cell(row, 3).number_format = ws.cell(row, 4).number_format = 'DD/MM/YYYY'
        for i, d in enumerate(days):
            cell = ws.cell(row, FIXED + 1 + i)
            if start <= d <= end:
                cell.fill = PatternFill('solid', fgColor=FILL[item['state']])
            elif d == today:
                cell.fill = PatternFill('solid', fgColor='F5C6C0')
        row += 1
ws.freeze_panes = ws.cell(2, FIXED + 1)
ws.auto_filter.ref = f'A1:{get_column_letter(FIXED)}{row - 1}'

legend = wb.create_sheet('Légende')
legend.append(['Couleur', 'Signification'])
for key, label in (('done', 'Réalisé et validé'), ('wait', 'Terminé, validation en attente'), ('plan', 'Prévu (prévision)'), ('ext', 'Décision ou prérequis externe (échéance)')):
    legend.append(['', label])
    legend.cell(legend.max_row, 1).fill = PatternFill('solid', fgColor=FILL[key])
legend.append(['', f"Colonne rouge : aujourd'hui ({today.strftime('%d/%m/%Y')}). Passé : dates de l'historique Git ; avenir : prévisions."])
legend.column_dimensions['A'].width = 12
legend.column_dimensions['B'].width = 90
legend['A1'].font = legend['B1'].font = Font(bold=True)

out = os.path.join(here, '..', 'GANTT-PROJET.xlsx')
wb.save(out)
print('✔', os.path.normpath(out), f'({row - 2} lots)')
