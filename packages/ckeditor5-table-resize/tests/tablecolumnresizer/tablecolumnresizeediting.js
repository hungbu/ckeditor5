/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global document */

import TableColumnResizeEditing from '../../src/tablecolumnresize/tablecolumnresizeediting';
import TableColumnResize from '../../src/tablecolumnresize';

// ClassicTestEditor can't be used, as it doesn't handle the focus, which is needed to test resizer visual cues.
import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableProperties from '@ckeditor/ckeditor5-table/src/tableproperties';
import { getData as getModelData, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
// import { getData as getViewData } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';

import { focusEditor } from '@ckeditor/ckeditor5-widget/tests/widgetresize/_utils/utils';
import { modelTable } from '@ckeditor/ckeditor5-table/tests/_utils/utils';
import {
	getDomTable,
	getModelTable,
	getColumnWidth,
	getViewColumnWidthsPx,
	getModelColumnWidthsPc,
	getViewColumnWidthsPc,
	getDomTableRects,
	getDomTableCellRects,
	tableColumnResizeMouseSimulator
} from './_utils/utils';
import {
	COLUMN_MIN_WIDTH_IN_PIXELS
} from '../../src/tablecolumnresize/constants';
import {
	clamp
} from '../../src/tablecolumnresize/utils';
import WidgetResize from '@ckeditor/ckeditor5-widget/src/widgetresize';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';

describe( 'TableColumnResizeEditing', () => {
	let model, editor, view, editorElement, contentDirection;
	const PERCENTAGE_PRECISION = 0.001;
	const PIXEL_PRECISION = 1;

	beforeEach( async () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );
		editor = await createEditor();

		model = editor.model;
		view = editor.editing.view;
		contentDirection = editor.locale.contentLanguageDirection;
	} );

	afterEach( async () => {
		if ( editorElement ) {
			editorElement.remove();
		}

		if ( editor ) {
			await editor.destroy();
		}
	} );

	it( 'should have a proper name', () => {
		expect( TableColumnResizeEditing.pluginName ).to.equal( 'TableColumnResizeEditing' );
	} );

	it( 'should have defined column widths in model', () => {
		setModelData( model, modelTable( [
			[ '00', '01', '02' ],
			[ '10', '11', '12' ]
		], { columnWidths: '25%,25%,50%' } ) );

		const tableWidths = model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' );

		expect( tableWidths ).to.be.equal( '25%,25%,50%' );
	} );

	it( 'should have defined col widths in view', () => {
		setModelData( model, modelTable( [
			[ '00', '01', '02' ],
			[ '10', '11', '12' ]
		], { columnWidths: '25%,25%,50%' } ) );

		const viewColWidths = [];

		for ( const item of view.createRangeIn( view.document.getRoot() ) ) {
			if ( item.item.is( 'element', 'col' ) ) {
				viewColWidths.push( item.item.getStyle( 'width' ) );
			}
		}

		expect( viewColWidths ).to.be.deep.equal( [ '25%', '25%', '50%' ] );
	} );

	describe( 'conversion', () => {
		describe( 'when upcasting <colgroup> attribute', () => {
			it( 'should handle the correct number of <col> elements', () => {
				editor.setData(
					`<figure class="table">
						<table>
							<colgroup>
								<col style="width:33.33%;">
								<col style="width:33.33%;">
								<col style="width:33.34%;">
							</colgroup>
							<tbody>
								<tr>
									<td>11</td>
									<td>12</td>
									<td>13</td>
								</tr>
							</tbody>
						</table>
					</figure>`
				);

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
					'<table columnWidths="33.33%,33.33%,33.34%">' +
						'<tableRow>' +
							'<tableCell columnIndex="0">' +
								'<paragraph>11</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="1">' +
								'<paragraph>12</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="2">' +
								'<paragraph>13</paragraph>' +
							'</tableCell>' +
						'</tableRow>' +
					'</table>'
				);
			} );

			it( 'should handle too small number of <col> elements', () => {
				editor.setData(
					`<figure class="table">
						<table>
							<colgroup>
								<col style="width:33.33%;">
								<col style="width:33.33%;">
							</colgroup>
							<tbody>
								<tr>
									<td>11</td>
									<td>12</td>
									<td>13</td>
								</tr>
							</tbody>
						</table>
					</figure>`
				);

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
					'<table columnWidths="33.33%,33.33%,33.34%">' +
						'<tableRow>' +
							'<tableCell columnIndex="0">' +
								'<paragraph>11</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="1">' +
								'<paragraph>12</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="2">' +
								'<paragraph>13</paragraph>' +
							'</tableCell>' +
						'</tableRow>' +
					'</table>'
				);
			} );

			it( 'should handle too big number of <col> elements', () => {
				editor.setData(
					`<figure class="table">
						<table>
							<colgroup>
								<col style="width:33.33%;">
								<col style="width:33.33%;">
								<col style="width:33.33%;">
								<col style="width:33.33%;">
							</colgroup>
							<tbody>
								<tr>
									<td>11</td>
									<td>12</td>
									<td>13</td>
								</tr>
							</tbody>
						</table>
					</figure>`
				);

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
					'<table columnWidths="33.33%,33.33%,33.34%">' +
						'<tableRow>' +
							'<tableCell columnIndex="0">' +
								'<paragraph>11</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="1">' +
								'<paragraph>12</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="2">' +
								'<paragraph>13</paragraph>' +
							'</tableCell>' +
						'</tableRow>' +
					'</table>'
				);
			} );

			it( 'should handle the incorrect elements inside', () => {
				editor.setData(
					`<figure class="table">
						<table>
							<colgroup>
								<p style="width:33.33%;"></p>
							</colgroup>
							<tbody>
								<tr>
									<td>11</td>
									<td>12</td>
									<td>13</td>
								</tr>
							</tbody>
						</table>
					</figure>`
				);

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
					'<table columnWidths="33.33%,33.33%,33.34%">' +
						'<tableRow>' +
							'<tableCell columnIndex="0">' +
								'<paragraph>11</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="1">' +
								'<paragraph>12</paragraph>' +
							'</tableCell>' +
							'<tableCell columnIndex="2">' +
								'<paragraph>13</paragraph>' +
							'</tableCell>' +
						'</tableRow>' +
					'</table>'
				);
			} );
		} );

		describe( 'model change integration', () => {
			describe( 'and the widhtStrategy is "manualWidth"', () => {
				it( 'should create resizers when table is inserted', () => {
					editor.execute( 'insertTable' );

					model.change( writer => {
						const table = model.document.getRoot().getChild( 0 );

						writer.setAttribute( 'widthStrategy', 'manualWidth', table );
					} );

					const domTable = getDomTable( view );
					const resizers = Array.from( domTable.querySelectorAll( '.table-column-resizer' ) );

					expect( resizers.length ).to.equal( 4 );
				} );

				it( 'should create resizers when row is inserted', () => {
					setModelData( model, modelTable( [
						[ '00', '01', '02' ],
						[ '10', '11', '[12]' ]
					], { columnWidths: '25%,25%,50%' } ) );

					editor.execute( 'insertTableRowBelow' );

					const domTable = getDomTable( view );
					const resizers = Array.from( domTable.querySelectorAll( '.table-column-resizer' ) );

					expect( resizers.length ).to.equal( 9 );
				} );

				it( 'should create resizers when cell from splitting is inserted', () => {
					setModelData( model, modelTable( [
						[ '00', '01', '02' ],
						[ '10', '11', '[12]' ]
					], { columnWidths: '25%,25%,50%' } ) );

					editor.execute( 'splitTableCellVertically' );

					const domTable = getDomTable( view );
					const resizers = Array.from( domTable.querySelectorAll( '.table-column-resizer' ) );

					expect( resizers.length ).to.equal( 7 );
				} );
			} );
		} );
	} );

	describe( 'post-fixer', () => {
		describe( 'correctly assigns the "columnIndex" attribute value', () => {
			it( 'when the column is added at the beginning', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'insertTableColumnLeft' );

				const expectedIndexes = {
					'00': 1,
					'01': 2,
					'02': 3,
					'10': 1,
					'11': 2,
					'12': 3
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the column is added in the middle', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'insertTableColumnRight' );

				const expectedIndexes = {
					'00': 0,
					'01': 2,
					'02': 3,
					'10': 0,
					'11': 2,
					'12': 3
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the column is added at the end', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '[02]' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'insertTableColumnRight' );

				const expectedIndexes = {
					'00': 0,
					'01': 1,
					'02': 2,
					'10': 0,
					'11': 1,
					'12': 2
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the fist column is removed', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'removeTableColumn' );

				const expectedIndexes = {
					'01': 0,
					'02': 1,
					'11': 0,
					'12': 1
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the middle column is removed', () => {
				setModelData( model, modelTable( [
					[ '00', '[01]', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'removeTableColumn' );

				const expectedIndexes = {
					'00': 0,
					'02': 1,
					'10': 0,
					'12': 1
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the last column is removed', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '[02]' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'removeTableColumn' );

				const expectedIndexes = {
					'00': 0,
					'01': 1,
					'10': 0,
					'11': 1
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );
		} );

		it( 'transfers the inline cell width to the whole column', () => {
			setModelData( model, modelTable( [
				[ '00', '01', '[02]' ],
				[ '10', '11', '12' ]
			], { columnWidths: '25%,25%,50%' } ) );

			const table = model.document.getRoot().getChild( 0 );

			// We define table width precisely to be able to predict column widths in %.
			// Setting table width to 201px causes the columns to have initially: [50px][50px][100px]
			editor.editing.view.change( writer => {
				const viewEditableRoot = editor.editing.view.document.getRoot().getChild( 0 ).getChild( 1 );
				writer.setAttribute( 'style', 'width: 201px;', viewEditableRoot );
			} );

			model.change( writer => {
				const cell = table.getChild( 1 ).getChild( 1 );

				writer.setAttribute( 'width', '100px', cell );
			} );

			const tableWidths = table.getAttribute( 'columnWidths' );

			expect( tableWidths ).to.be.equal( '25%,50%,25%' );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			expect( Math.abs( 100 - finalViewColumnWidthsPx[ 1 ] ) < PIXEL_PRECISION ).to.be.true;
		} );
	} );

	describe( 'does not resize', () => {
		it( 'without dragging', () => {
			// Test-specific.
			const columnToResizeIndex = 0;
			const mouseMovementVector = { x: 0, y: 0 };

			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%' } ) );

			// Test-agnostic.
			const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector, 1 );

			const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

			assertModelWidthsSum( finalModelColumnWidthsPc );

			const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

			assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
			const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
				initialViewColumnWidthsPx,
				mouseMovementVector,
				contentDirection,
				columnToResizeIndex
			);

			assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
		} );
	} );

	describe( 'while resizing', () => {
		describe( 'right or left', () => {
			it( 'shrinks the first table column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'expands the first table column on dragging right', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: 10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'shrinks the last column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 2;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'does not remove column when it was shrinked to negative width', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 1;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: -( initialColumnWidth * 1.05 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

				expect( view.document.getRoot()
					.getChild( 0 ) // figure
					.getChild( 1 ) // table
					.getChild( 1 ) // tbody
					.getChild( 0 ) // tr
					.childCount
				).to.equal( 3 );
			} );

			it( 'does not remove column when adjacent column was expanded over it', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 0;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: ( initialColumnWidth * 1.05 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

				expect( view.document.getRoot()
					.getChild( 0 ) // figure
					.getChild( 1 ) // table
					.getChild( 1 ) // tbody
					.getChild( 0 ) // tr
					.childCount
				).to.equal( 3 );
			} );

			it( 'resizes column with a colspan in the first row', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ { contents: '00', colspan: 2 }, '02' ],
					[ '10', '11', '12' ],
					[ '20', '21', '22' ]
				], { columnWidths: '20%,25%,55%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector, 1 );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correct column with a rowspan in the last column', () => {
				// Test-specific.
				const columnToResizeIndex = 1;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', { contents: '02', rowspan: 3 } ],
					[ '10', '11' ],
					[ '20', '21' ]
				], { columnWidths: '20%,25%,55%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector, 2 );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			describe( 'in editor with TableProperties, where there are 2 tables: centered and aligned', () => {
				let editor, view, editorElement;

				beforeEach( async () => {
					editorElement = document.createElement( 'div' );
					document.body.appendChild( editorElement );
					editor = await createEditor( null, [ TableProperties ] );

					view = editor.editing.view;
					contentDirection = editor.locale.contentLanguageDirection;
				} );

				afterEach( async () => {
					if ( editorElement ) {
						editorElement.remove();
					}

					if ( editor ) {
						await editor.destroy();
					}
				} );

				it( 'shrinks the table twice as much when resizing centered table as compared to aligned table', () => {
					const columnToResizeIndex = 1;
					const mouseMovementVector = { x: -10, y: 0 };

					editor.setData(
						`<figure class="table" style="float:left;">
							<table>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector, 0 );

					const alignedTableColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

					editor.setData(
						`<figure class="table">
							<table>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector, 0 );

					const centeredTableColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
					const widthDifference = centeredTableColumnWidthsPx[ 1 ] - alignedTableColumnWidthsPx[ 1 ];

					expect( Math.abs( widthDifference - mouseMovementVector.x ) < PIXEL_PRECISION ).to.be.true;
				} );
			} );
		} );

		describe( 'right or left (RTL)', () => {
			beforeEach( async () => {
				if ( editor ) {
					await editor.destroy();
				}

				editor = await createEditor( {
					language: 'ar'
				} );

				model = editor.model;
				view = editor.editing.view;
				contentDirection = editor.locale.contentLanguageDirection;
			} );

			it( 'shrinks the first table column on dragging right', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: 10, y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'expands the first table column on dragging left', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'shrinks the last column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 2;
				const mouseMovementVector = { x: 10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'does not remove column when it was shrinked to negative width', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 1;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: initialColumnWidth * 1.05, y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

				expect( view.document.getRoot()
					.getChild( 0 ) // figure
					.getChild( 1 ) // table
					.getChild( 1 ) // tbody
					.getChild( 0 ) // tr
					.childCount
				).to.equal( 3 );
			} );

			it( 'does not remove column when adjacent column was expanded over it', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 0;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: -( initialColumnWidth * 1.05 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );
		} );

		describe( 'if cursor was moved outside the table', () => {
			it( 'resizes correctly if cursor was placed above the table', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 0;
				const cellRect = getDomTableCellRects( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: 10, y: -( cellRect.height ) };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correctly if cursor was placed under the table', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 0;
				const tableRect = getDomTableRects( getDomTable( view ) );
				const mouseMovementVector = { x: 10, y: tableRect.height };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correctly if cursor was placed outside left table border', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 0;
				const cellRect = getDomTableCellRects( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: -( cellRect.width + 20 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correctly if cursor was placed outside right table border', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const columnToResizeIndex = 1;
				// We need the width of the last cell to move the cursor beyond it.
				const cellRect = getDomTableCellRects( getDomTable( view ), 2 );
				const mouseMovementVector = { x: ( cellRect.width + 40 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, view, columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( view );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );
		} );
	} );

	describe( 'in integration with', () => {
		describe.skip( 'undo', () => {

		} );

		describe( 'table', () => {
			describe( 'structure manipulation', () => {
				describe( 'should adjust attributes in model', () => {
					it( 'when new column was inserted', () => {
						setModelData( model, modelTable( [
							[ '00[]', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						editor.commands.get( 'insertTableColumnLeft' ).execute();

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 4 values.
							if ( item.item.is( 'element', 'table' ) ) {
								expect( item.item.getAttribute( 'columnWidths' ).split( ',' ).length ).to.equal( 4 );
							}
							// Expect the cell containing text '00' to have index 1 instead of 0.
							else if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
								const text = item.item.getChild( 0 ).getChild( 0 ).data;

								if ( text == '00' ) {
									expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( 1 );
								}
							}
						}
					} );

					it( 'when column was removed', () => {
						setModelData( model, modelTable( [
							[ '00[]', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						editor.execute( 'removeTableColumn' );

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 2 values and the first column to take over the width of removed one.
							if ( item.item.is( 'element', 'table' ) ) {
								const columnWidths = item.item.getAttribute( 'columnWidths' ).split( ',' );
								expect( columnWidths.length ).to.equal( 2 );
								expect( columnWidths[ 0 ] ).to.equal( '45%' );
							}
							// Expect the cell containing text '01' to have index 0 instead of 1.
							else if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
								const text = item.item.getChild( 0 ).getChild( 0 ).data;

								if ( text == '01' ) {
									expect( item.item.getAttribute( 'columnIndex' ) ).to.equal( 0 );
								}
							}
						}
					} );

					it( 'when two columns were merged', () => {
						setModelData( model, modelTable( [
							[ '00', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						selectNodes( model, [
							[ 0, 0, 0 ],
							[ 0, 1, 0 ],
							[ 0, 0, 1 ],
							[ 0, 1, 1 ]
						] );

						editor.execute( 'mergeTableCells' );

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 2 values and the first column to take over the width of merged one.
							if ( item.item.is( 'element', 'table' ) ) {
								const columnWidths = item.item.getAttribute( 'columnWidths' ).split( ',' );
								expect( columnWidths.length ).to.equal( 2 );
								expect( columnWidths[ 0 ] ).to.equal( '45%' );
							}
							// There should not be a cell with columnIndex='2'.
							else if ( item.item.is( 'element', 'tableCell' ) ) {
								const index = item.item.getAttribute( 'columnIndex' );
								expect( index ).not.to.equal( 2 );
							}
						}
					} );
				} );

				describe( 'should not adjust `columnWidths` attribute in model', () => {
					it( 'when only some cells from two columns were merged', () => {
						setModelData( model, modelTable( [
							[ '00', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						selectNodes( model, [
							[ 0, 0, 0 ],
							[ 0, 0, 1 ]
						] );

						editor.execute( 'mergeTableCells' );

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 3 unchanged values.
							if ( item.item.is( 'element', 'table' ) ) {
								const columnWidths = item.item.getAttribute( 'columnWidths' ).split( ',' );
								expect( columnWidths.length ).to.equal( 3 );
								expect( columnWidths[ 0 ] ).to.equal( '20%' );
								expect( columnWidths[ 1 ] ).to.equal( '25%' );
								expect( columnWidths[ 2 ] ).to.equal( '55%' );
							}
						}
					} );
				} );

				describe( 'should not remove colgroup', () => {
					it( 'after pasting a table that increases number of rows and columns at the same time', () => {
						setModelData( model, modelTable( [
							[ '00', '01' ],
							[ '10', '[11]' ]
						], { columnWidths: '50%,50%' } ) );

						model.change( () => {
							editor.execute( 'insertTableRowBelow' );
							editor.execute( 'insertTableColumnRight' );
						} );

						const tableView = view.document.getRoot().getChild( 0 ).getChild( 1 );

						expect( [ ...tableView.getChildren() ].find(
							viewElement => viewElement.is( 'element', 'colgroup' ) )
						).to.not.be.undefined;
					} );
				} );
			} );
		} );
	} );

	async function createEditor( configCustomization, additionalPlugins ) {
		const plugins = [ Table, TableColumnResize, TableColumnResizeEditing, Paragraph, WidgetResize ];

		if ( additionalPlugins ) {
			plugins.push( ...additionalPlugins );
		}

		const newEditor = await ClassicEditor.create( editorElement, Object.assign( {}, {
			plugins
		}, configCustomization ) );

		await focusEditor( newEditor );

		return newEditor;
	}

	function selectNodes( model, paths ) {
		const root = model.document.getRoot( 'main' );

		model.change( writer => {
			const ranges = paths.map( path => writer.createRangeOn( root.getNodeByPath( path ) ) );

			writer.setSelection( ranges );
		} );
	}

	function assertModelViewSync( modelColumnWidths, viewColumnWidths ) {
		expect( modelColumnWidths ).to.be.deep.equal( viewColumnWidths );
	}

	function assertViewPixelWidths( finalViewWidths, expectedViewWidths ) {
		for ( let i = 0; i < finalViewWidths.length; i++ ) {
			// We can't use `expect( finalViewWidths[ i ] ).to.equal( expectedViewWidths[ i ] )`
			// because we need to tolerate some error margin.
			expect(
				Math.abs( finalViewWidths[ i ] - expectedViewWidths[ i ] ) < PIXEL_PRECISION,
				'column ' + i + ' has width ' + finalViewWidths[ i ] + ' instead of ' + expectedViewWidths[ i ]
			).to.be.true;
		}
	}

	function assertModelWidthsSum( columnWidths ) {
		const widthsSum = columnWidths.reduce( ( sum, element ) => {
			sum += Number( element );

			return sum;
		}, 0 );

		expect( ( Math.abs( 100 - widthsSum ) ) < PERCENTAGE_PRECISION ).to.be.true;
	}

	function calculateExpectedWidthPixels( initialWidths, vector, contentDirection, columnIndex ) {
		const resultingWidths = initialWidths.slice();

		// resultingWidths[ columnIndex ] = Math.max(
		// 	resultingWidths[ columnIndex ] + ( contentDirection == 'ltr' ? vector.x : -vector.x ),
		// 	COLUMN_MIN_WIDTH_IN_PIXELS
		// );
		resultingWidths[ columnIndex ] = clamp(
			resultingWidths[ columnIndex ] + ( contentDirection == 'ltr' ? vector.x : -vector.x ),
			COLUMN_MIN_WIDTH_IN_PIXELS,
			// Seemingly complex logic but it just ensures that the next column is at least COLUMN_MIN_WIDTH_IN_PIXELS wide.
			resultingWidths[ columnIndex ] + resultingWidths[ columnIndex + 1 ] - COLUMN_MIN_WIDTH_IN_PIXELS
		);

		const widthChange = resultingWidths[ columnIndex ] - initialWidths[ columnIndex ];

		// If the last column is resized, it decreases the width twice as much but no other column
		// changes the size.
		if ( !resultingWidths[ columnIndex + 1 ] ) {
			resultingWidths[ columnIndex ] += widthChange;

			return resultingWidths;
		}

		// Expect the other column to shrink/expand just as much as the first one was resized.
		resultingWidths[ columnIndex + 1 ] = initialWidths[ columnIndex + 1 ] - widthChange;

		return resultingWidths;
	}
} );
