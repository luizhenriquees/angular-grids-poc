import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { AgGrigInternationalisation } from '../ag-grig-internationalisation';
import { GridApi } from 'ag-grid-community';
import { ColumnApi } from 'ag-grid-community/dist/lib/columnController/columnApi';
import { ColumnState } from 'ag-grid-community/dist/lib/columnController/columnController';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';

declare global {
	interface Window {
		colState: ColumnState[];
		groupState: {
			groupId: string;
			open: boolean;
		}[];
		sortState: {
			colId: string;
			sort: string;
		}[];
		filterState: {
			[key: string]: any;
		};
	}
}

@Component({
	selector   : 'app-ag-grid',
	templateUrl: './ag-grid.component.html',
	styleUrls  : ['./ag-grid.component.scss']
})
export class AgGridComponent implements OnInit, AfterViewInit {

	columnDefs = [
		{
			headerName  : 'País', field: 'country', sortable: true, filter: true, checkboxSelection: true,
			filterParams: {
				buttons   : ['limpar', 'aplicar'],
				debounceMs: 200
			}
		},
		{ headerName: 'Idade', field: 'age', sortable: true, filter: false },
		{ headerName: 'Ano', field: 'year', sortable: true, type: 'numberColumn', },
		{
			headerName: 'Data',
			field     : 'date',
			sortable  : true,
			comparator: dateComparator,
			width     : 220,
		},
		{ headerName: 'Esporte', field: 'sport', sortable: true, filter: 'agSetColumnFilter' },
		{ headerName: 'Ouro', field: 'gold', sortable: true, filter: true, type: 'medalColumn', },
		{ headerName: 'Prata', field: 'silver', sortable: true, filter: true, type: 'medalColumn', },
		{ headerName: 'Bronze', field: 'bronze', sortable: true, filter: true, type: 'medalColumn', },
		{ headerName: 'Total', field: 'total', sortable: true, filter: false },
		// {
		// 	field         : 'price', sortable: true, filter: true,
		// 	valueFormatter: params => params.data.price.toFixed(2),
		// }
	];

	columnTypes = {
		numberColumn     : {
			width : 130,
			filter: 'agNumberColumnFilter',
		},
		medalColumn      : {
			width          : 100,
			columnGroupShow: 'open',
			filter         : false,
		},
		nonEditableColumn: { editable: false },
		dateColumn       : {
			filter      : 'agDateColumnFilter',
			filterParams: {
				// tslint:disable-next-line:typedef
				comparator(filterLocalDateAtMidnight, cellValue) {
					const dateParts = cellValue.split('/');
					const day = Number(dateParts[0]);
					const month = Number(dateParts[1]) - 1;
					const year = Number(dateParts[2]);
					const cellDate = new Date(year, month, day);
					if (cellDate < filterLocalDateAtMidnight) {
						return -1;
					} else if (cellDate > filterLocalDateAtMidnight) {
						return 1;
					} else {
						return 0;
					}
				},
			},
		},
	};

	defaultColDef = {
		flex     : 1,
		minWidth : 100,
		filter   : true,
		resizable: true,
		sortable : true,
	};

	autoGroupColumnDef = {
		headerName        : 'País',
		field             : 'country',
		cellRenderer      : 'agGroupCellRenderer',
		cellRendererParams: {
			checkbox: true
		}
	};

	rowData: any;
	@ViewChild('agGrid') agGrid: AgGridAngular;
	@ViewChild('inputPesquisa') inputPesquisaRef: ElementRef;
	private gridApi?: GridApi;
	private gridColumnApi?: ColumnApi;

	public filtroGeral: string;
	filtroGeralUpdate = new Subject<string>();

	constructor(
		private http: HttpClient,
		public agGrigInternationalisation: AgGrigInternationalisation) {
	}

	ngOnInit(): void {
	}

	ngAfterViewInit(): void {
		this.filtroGeralUpdate.pipe(
			filter(Boolean),
			debounceTime(700),
			distinctUntilChanged())
			.subscribe(value => {
				this.gridApi.setQuickFilter(value);
			});
	}

	myDateComparator(filterLocalDateAtMidnight, cellValue): number {
		const dateAsString = cellValue;
		if (dateAsString == null) {
			return -1;
		}
		const dateParts = dateAsString.split('/');
		const cellDate = new Date(
			Number(dateParts[2]),
			Number(dateParts[1]) - 1,
			Number(dateParts[0])
		);
		if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
			return 0;
		}
		if (cellDate < filterLocalDateAtMidnight) {
			return -1;
		}
		if (cellDate > filterLocalDateAtMidnight) {
			return 1;
		}
	}

	private _showLoading(): void {
		this.gridApi?.showLoadingOverlay();
	}

	private _hideOverlay(): void {
		this.gridApi?.hideOverlay();
	}

	getSelectedRows(): void {
		const selectedNodes = this.agGrid.api.getSelectedNodes();
		const selectedData = selectedNodes.map(node => node.data);
		const selectedDataStringPresentation = selectedData.map(node => node.make + ' ' + node.model).join(', ');
		alert(`Selected nodes: ${ selectedDataStringPresentation }`);
	}

	public getJSON(): Observable<any> {
		return this.http.get('assets/teste.json');
	}

	onGridReady(params: any): void {
		this.gridApi = params.api;
		this.gridColumnApi = params.columnApi;

		this.http.get('assets/teste.json').subscribe(data => {
			this._showLoading();
			this.rowData = data;
			this._hideOverlay();
		});
	}

	saveState(): void {
		window.colState = this.gridColumnApi.getColumnState();
		window.groupState = this.gridColumnApi.getColumnGroupState();
		window.sortState = this.gridApi.getSortModel();
		window.filterState = this.gridApi.getFilterModel();
		console.log('column state saved');
	}

	restoreState(): void {
		if (!window.colState) {
			console.log('no columns state to restore by, you must save state first');
			return;
		}
		this.gridColumnApi.setColumnState(window.colState);
		this.gridColumnApi.setColumnGroupState(window.groupState);
		this.gridApi.setSortModel(window.sortState);
		this.gridApi.setFilterModel(window.filterState);
		console.log('column state restored');
	}

	onPrintQuickFilterTexts(): void {
		this.gridApi.forEachNode((rowNode, index) => {
			console.log('Row ' + index + ' quick filter text is ' + rowNode.quickFilterAggregateText);
		});
	}

}

function dateComparator(date1, date2): number {
	const date1Number = monthToComparableNumber(date1);
	const date2Number = monthToComparableNumber(date2);
	if (date1Number === null && date2Number === null) {
		return 0;
	}
	if (date1Number === null) {
		return -1;
	}
	if (date2Number === null) {
		return 1;
	}
	return date1Number - date2Number;
}

function monthToComparableNumber(date): number {
	if (date === undefined || date === null || date.length !== 10) {
		return null;
	}
	const yearNumber = date.substring(6, 10);
	const monthNumber = date.substring(3, 5);
	const dayNumber = date.substring(0, 2);
	return yearNumber * 10000 + monthNumber * 100 + dayNumber;
}
