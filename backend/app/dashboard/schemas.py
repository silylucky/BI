from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_serializer, model_validator

from app.dashboard.gap_policy import normalize_gap_config
from app.schemas.chart_view import ChartFieldRef, ChartFilterRef, ChartViewConfigLayout
from app.viz.components.schemas import VizComponentRef

FilterControlType = Literal["text", "select", "date", "multiselect"]
TextVariant = Literal["markdown", "plain", "html"]
MediaFit = Literal["contain", "cover", "fill"]
MediaWidgetKind = Literal["image", "webpage"]
WidgetType = Literal["chart", "filter", "text", "media", "tabs", "customViz"]
# 本地上传以 data URL 写入 layoutJson；与 FE MAX_IMAGE_SOURCE_BYTES(2MB) 对齐（base64≈4/3 + 头）
IMAGE_DATA_URL_MAX_LENGTH = 3_145_728
CANVAS_WIDTH = 1440
DATA_SCREEN_CANVAS_WIDTH = 1920
MIN_CANVAS_HEIGHT = 900
DATA_SCREEN_CANVAS_HEIGHT = 1080
DATA_SCREEN_CANVAS_MIN_WIDTH = 800
DATA_SCREEN_CANVAS_MAX_WIDTH = 7680
DATA_SCREEN_CANVAS_MIN_HEIGHT = 600
DATA_SCREEN_CANVAS_MAX_HEIGHT = 4320
PIXEL_COLUMN_WIDTH = 120
MIN_PIXEL_WIDGET_WIDTH = PIXEL_COLUMN_WIDTH
MIN_PIXEL_WIDGET_HEIGHT = 32
TAB_PARKED_PIXEL_WIDTH = 0
TAB_PARKED_PIXEL_HEIGHT = 0
_V1_WIDGET_FIELDS = frozenset({"colSpan", "rowSpan", "gridX", "gridY", "col_span", "row_span", "grid_x", "grid_y"})
_V2_WIDGET_FIELDS = frozenset({"x", "y", "width", "height"})


class FilterOption(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    label: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=256)


class FilterWidgetConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    filter_id: str = Field(alias="filterId", min_length=1, max_length=64)
    dimension_ref: str = Field(alias="dimensionRef", min_length=1, max_length=128)
    control_type: FilterControlType = Field(default="text", alias="controlType")
    default_value: str | None = Field(default=None, alias="defaultValue")
    options: list[FilterOption] = Field(default_factory=list)
    parameter_key: str | None = Field(default=None, alias="parameterKey", max_length=64)


class TextWidgetConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    content: str = Field(default="", max_length=8000)
    variant: TextVariant = "plain"
    dataset_id: str | None = Field(default=None, alias="datasetId", max_length=64)
    dimension_field: str | None = Field(default=None, alias="dimensionField", max_length=128)
    metric_field: str | None = Field(default=None, alias="metricField", max_length=128)
    screen_style: dict[str, Any] | None = Field(default=None, alias="screenStyle")
    widget_style: WidgetStyleConfig | None = Field(default=None, alias="widgetStyle")


class MediaWidgetConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    kind: MediaWidgetKind = "image"
    url: str = Field(default="", max_length=IMAGE_DATA_URL_MAX_LENGTH)
    alt: str = Field(default="", max_length=256)
    fit: MediaFit = "contain"
    widget_style: WidgetStyleConfig | None = Field(default=None, alias="widgetStyle")


class TabPaneConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=120)
    child_widget_ids: list[str] = Field(default_factory=list, alias="childWidgetIds", max_length=16)


class TabsWidgetConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    tabs_id: str = Field(alias="tabsId", min_length=1, max_length=64)
    panes: list[TabPaneConfig] = Field(min_length=1, max_length=8)
    active_pane_id: str = Field(alias="activePaneId", min_length=1, max_length=64)
    widget_style: WidgetStyleConfig | None = Field(default=None, alias="widgetStyle")


class CustomVizMetricRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field: str = Field(min_length=1, max_length=128)
    label: str | None = Field(default=None, max_length=128)
    agg: Literal["sum", "avg", "max", "min", "count"] = "sum"


class CustomVizDataBinding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: Literal["manual", "connected"] = "manual"
    data_source_id: str | None = Field(default=None, alias="dataSourceId", max_length=64)
    dataset_id: str | None = Field(default=None, alias="datasetId", max_length=64)
    config_id: str | None = Field(default=None, alias="configId", max_length=64)
    dimensions: list[ChartFieldRef] = Field(default_factory=list)
    metrics: list[CustomVizMetricRef] = Field(default_factory=list)
    filters: list[ChartFilterRef] = Field(default_factory=list)
    refresh_mode: str | None = Field(default=None, alias="refreshMode", max_length=32)
    result_limit: str | None = Field(default=None, alias="resultLimit", max_length=16)


class CustomVizWidgetConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    artifact_id: uuid.UUID = Field(alias="artifactId")
    data_binding: CustomVizDataBinding | None = Field(default=None, alias="dataBinding")
    style: dict[str, Any] | None = None
    widget_style: WidgetStyleConfig | None = Field(default=None, alias="widgetStyle")


class WidgetStyleConfig(BaseModel):
    """对齐 FE `dashboardStyleConfig.WidgetStyleConfig`，禁止静默丢装饰/内边距字段。"""

    model_config = ConfigDict(populate_by_name=True)
    background: str | None = Field(default=None, max_length=512)
    background_image: str | None = Field(
        default=None, alias="backgroundImage", max_length=IMAGE_DATA_URL_MAX_LENGTH
    )
    background_show: bool | None = Field(default=None, alias="backgroundShow")
    background_mode: Literal["image", "frame", "border"] | None = Field(
        default=None, alias="backgroundMode"
    )
    frame_preset_id: str | None = Field(default=None, alias="framePresetId", max_length=32)
    frame_color: str | None = Field(default=None, alias="frameColor", max_length=64)
    frame_opacity: float | None = Field(default=None, alias="frameOpacity", ge=0, le=1)
    opacity: float | None = Field(default=None, ge=0, le=1)
    background_image_opacity: float | None = Field(
        default=None, alias="backgroundImageOpacity", ge=0, le=1
    )
    background_image_fit: Literal[
        "stretch", "contain", "cover", "widthFit", "heightFit", "original"
    ] | None = Field(default=None, alias="backgroundImageFit")
    background_image_position: str | None = Field(
        default=None, alias="backgroundImagePosition", max_length=32
    )
    backdrop_blur: float | None = Field(default=None, alias="backdropBlur", ge=0, le=64)
    border_radius: int | None = Field(default=None, alias="borderRadius", ge=0, le=48)
    border_radius_top_left: int | None = Field(
        default=None, alias="borderRadiusTopLeft", ge=0, le=48
    )
    border_radius_top_right: int | None = Field(
        default=None, alias="borderRadiusTopRight", ge=0, le=48
    )
    border_radius_bottom_left: int | None = Field(
        default=None, alias="borderRadiusBottomLeft", ge=0, le=48
    )
    border_radius_bottom_right: int | None = Field(
        default=None, alias="borderRadiusBottomRight", ge=0, le=48
    )
    radius_mode: Literal["unified", "individual"] | None = Field(default=None, alias="radiusMode")
    padding: int | None = Field(default=None, ge=0, le=64)
    padding_top: int | None = Field(default=None, alias="paddingTop", ge=0, le=64)
    padding_right: int | None = Field(default=None, alias="paddingRight", ge=0, le=64)
    padding_bottom: int | None = Field(default=None, alias="paddingBottom", ge=0, le=64)
    padding_left: int | None = Field(default=None, alias="paddingLeft", ge=0, le=64)
    padding_mode: Literal["unified", "individual"] | None = Field(
        default=None, alias="paddingMode"
    )
    border_color: str | None = Field(default=None, alias="borderColor", max_length=64)
    border_width: int | None = Field(default=None, alias="borderWidth", ge=0, le=8)
    border_style: Literal["solid", "dashed", "dotted"] | None = Field(
        default=None, alias="borderStyle"
    )
    border_enabled: bool | None = Field(default=None, alias="borderEnabled")


class TitleStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    show: bool | None = None
    font_size: int | None = Field(default=None, alias="fontSize", ge=8, le=48)
    color: str | None = Field(default=None, max_length=64)
    font_weight: int | None = Field(default=None, alias="fontWeight", ge=100, le=900)
    font_style: Literal["normal", "italic"] | None = Field(default=None, alias="fontStyle")
    align: Literal["left", "center", "right"] | None = None
    letter_spacing: float | None = Field(default=None, alias="letterSpacing", ge=-2, le=8)
    shadow: bool | None = None


class FilterChromeStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    title_position: Literal["top", "left"] | None = Field(default=None, alias="titlePosition")
    title_color: str | None = Field(default=None, alias="titleColor", max_length=64)


class FilterControlStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    border_radius: int | None = Field(default=None, alias="borderRadius", ge=0, le=24)
    height: int | None = Field(default=None, ge=24, le=56)


class DialogStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    background: str | None = Field(default=None, max_length=512)
    font_color: str | None = Field(default=None, alias="fontColor", max_length=64)


class DashboardAlignmentSnapConfig(BaseModel):
    """像素画布编辑态对齐吸附细项（存于 styleConfig.chrome.alignmentSnap）。"""

    model_config = ConfigDict(populate_by_name=True)
    enable_mark_line_snap: bool | None = Field(default=None, alias="enableMarkLineSnap")
    collision_overlap_buffer_px: int | None = Field(
        default=None,
        alias="collisionOverlapBufferPx",
        ge=0,
        le=80,
    )
    mark_line_threshold_px: int | None = Field(
        default=None,
        alias="markLineThresholdPx",
        ge=2,
        le=24,
    )
    grid_cell_px: int | None = Field(default=None, alias="gridCellPx", ge=8, le=48)
    snap_edges: bool | None = Field(default=None, alias="snapEdges")
    snap_centers: bool | None = Field(default=None, alias="snapCenters")


class DashboardChromeConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    show_chart_loading_hint: bool | None = Field(default=None, alias="showChartLoadingHint")
    show_floating_actions: bool | None = Field(default=None, alias="showFloatingActions")
    show_chart_action_buttons: bool | None = Field(default=None, alias="showChartActionButtons")
    show_auxiliary_grid: bool | None = Field(default=None, alias="showAuxiliaryGrid")
    alignment_snap: DashboardAlignmentSnapConfig | None = Field(default=None, alias="alignmentSnap")


class ChartLabelStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    font_size: int | None = Field(default=None, alias="fontSize", ge=8, le=48)
    color: str | None = Field(default=None, max_length=64)


class ChartTooltipStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    font_size: int | None = Field(default=None, alias="fontSize", ge=8, le=48)
    color: str | None = Field(default=None, max_length=64)
    background: str | None = Field(default=None, max_length=512)


class TableColorStyleConfig(BaseModel):
    """对齐 FE `ChartDeTableStyle` 看板默认表配色（子集 + 透传常用项）。"""

    model_config = ConfigDict(populate_by_name=True)
    opacity: float | None = Field(default=None, ge=0, le=100)
    header_bg: str | None = Field(default=None, alias="headerBg", max_length=64)
    header_fg: str | None = Field(default=None, alias="headerFg", max_length=64)
    body_bg: str | None = Field(default=None, alias="bodyBg", max_length=64)
    body_fg: str | None = Field(default=None, alias="bodyFg", max_length=64)
    summary_bg: str | None = Field(default=None, alias="summaryBg", max_length=64)
    summary_fg: str | None = Field(default=None, alias="summaryFg", max_length=64)
    zebra_bg: str | None = Field(default=None, alias="zebraBg", max_length=64)
    zebra_striped: bool | None = Field(default=None, alias="zebraStriped")
    column_bg: str | None = Field(default=None, alias="columnBg", max_length=64)
    corner_bg: str | None = Field(default=None, alias="cornerBg", max_length=64)
    empty_hint_fg: str | None = Field(default=None, alias="emptyHintFg", max_length=64)
    pagination_fg: str | None = Field(default=None, alias="paginationFg", max_length=64)
    pagination_font_size: int | None = Field(
        default=None, alias="paginationFontSize", ge=8, le=48
    )
    scrollbar_color: str | None = Field(default=None, alias="scrollbarColor", max_length=64)
    border_color: str | None = Field(default=None, alias="borderColor", max_length=64)
    pagination_mode: Literal["page", "scroll"] | None = Field(
        default=None, alias="paginationMode"
    )
    page_size: Literal[20, 50, 100] | None = Field(default=None, alias="pageSize")
    pagination_variant: Literal["compact", "normal"] | None = Field(
        default=None, alias="paginationVariant"
    )
    column_width_mode: Literal["auto", "fixed", "custom"] | None = Field(
        default=None, alias="columnWidthMode"
    )
    column_widths: dict[str, float] | None = Field(default=None, alias="columnWidths")
    column_widths_px: dict[str, int] | None = Field(default=None, alias="columnWidthsPx")
    series_column_width_px: int | None = Field(
        default=None, alias="seriesColumnWidthPx", ge=1, le=512
    )
    row_height_px: int | None = Field(default=None, alias="rowHeightPx", ge=16, le=256)
    word_wrap: bool | None = Field(default=None, alias="wordWrap")
    row_hover: bool | None = Field(default=None, alias="rowHover")
    show_summary: bool | None = Field(default=None, alias="showSummary")


class DataScreenPlaylistConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    screen_ids: list[str] = Field(default_factory=list, alias="screenIds", max_length=32)
    interval_sec: int = Field(default=30, alias="intervalSec", ge=5, le=3600)


class ThemeVariantWidgetStyle(BaseModel):
    """DE §5.3 / 组件壳：随浅/深分别记忆的字段子集。"""

    model_config = ConfigDict(populate_by_name=True)
    background: str | None = Field(default=None, max_length=512)
    border_color: str | None = Field(default=None, alias="borderColor", max_length=64)
    border_width: int | None = Field(default=None, alias="borderWidth", ge=0, le=8)
    border_style: Literal["solid", "dashed", "dotted"] | None = Field(
        default=None, alias="borderStyle"
    )
    border_enabled: bool | None = Field(default=None, alias="borderEnabled")
    opacity: float | None = Field(default=None, ge=0, le=1)


class ThemeVariantTitleStyle(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    color: str | None = Field(default=None, max_length=64)


class ThemeVariantFields(BaseModel):
    """DE 双主题：浅色/深色各自保存的画布与组件视觉（对标 themeVariants）。"""

    model_config = ConfigDict(populate_by_name=True)
    canvas_background: str | None = Field(default=None, alias="canvasBackground", max_length=512)
    canvas_background_image_fit: Literal[
        "stretch", "contain", "cover", "widthFit", "heightFit", "original"
    ] | None = Field(default=None, alias="canvasBackgroundImageFit")
    canvas_background_image_position: str | None = Field(
        default=None, alias="canvasBackgroundImagePosition", max_length=32
    )
    canvas_background_image: str | None = Field(
        default=None, alias="canvasBackgroundImage", max_length=IMAGE_DATA_URL_MAX_LENGTH
    )
    canvas_background_custom: bool | None = Field(default=None, alias="canvasBackgroundCustom")
    canvas_decor_preset_id: str | None = Field(
        default=None, alias="canvasDecorPresetId", max_length=64
    )
    theme_accent: str | None = Field(default=None, alias="themeAccent", max_length=64)
    widget_style: ThemeVariantWidgetStyle | None = Field(default=None, alias="widgetStyle")
    title_style: ThemeVariantTitleStyle | None = Field(default=None, alias="titleStyle")
    dialog_style: DialogStyleConfig | None = Field(default=None, alias="dialogStyle")
    filter_chrome_style: FilterChromeStyleConfig | None = Field(
        default=None, alias="filterChromeStyle"
    )


class DashboardThemeVariants(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    light: ThemeVariantFields | None = None
    dark: ThemeVariantFields | None = None


class NumberFormatConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    decimals: int | None = Field(default=None, ge=0, le=8)
    type: Literal["auto", "number", "percent", "currency"] | None = None
    unit: str | None = Field(default=None, max_length=16)
    thousand_separator: bool | None = Field(default=None, alias="thousandSeparator")


class DashboardStyleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    widget_gap: int | None = Field(default=None, ge=0, le=48, alias="widgetGap")
    canvas_background: str | None = Field(default=None, alias="canvasBackground", max_length=512)
    color_scheme: Literal["light", "dark"] | None = Field(default=None, alias="colorScheme")
    theme_accent: str | None = Field(default=None, alias="themeAccent", max_length=64)
    font_family: str | None = Field(default=None, alias="fontFamily", max_length=64)
    gap_preset: Literal["none", "sm", "md", "lg", "custom"] | None = Field(
        default=None, alias="gapPreset"
    )
    pixel_gutter: int | None = Field(default=None, alias="pixelGutter", ge=0, le=24)
    scale_mode: Literal["canvas", "component"] | None = Field(default=None, alias="scaleMode")
    canvas_background_image: str | None = Field(
        default=None, alias="canvasBackgroundImage", max_length=IMAGE_DATA_URL_MAX_LENGTH
    )
    canvas_background_image_fit: Literal[
        "stretch", "contain", "cover", "widthFit", "heightFit", "original"
    ] | None = Field(default=None, alias="canvasBackgroundImageFit")
    canvas_background_image_position: str | None = Field(
        default=None, alias="canvasBackgroundImagePosition", max_length=32
    )
    canvas_background_custom: bool | None = Field(default=None, alias="canvasBackgroundCustom")
    canvas_decor_preset_id: str | None = Field(
        default=None, alias="canvasDecorPresetId", max_length=64
    )
    refresh_interval_sec: int | None = Field(
        default=None, alias="refreshIntervalSec", ge=5, le=3600
    )
    default_query_limit: int | None = Field(
        default=None, alias="defaultQueryLimit", ge=1, le=10000
    )
    widget_style: WidgetStyleConfig | None = Field(default=None, alias="widgetStyle")
    palette_id: str | None = Field(default=None, alias="paletteId", max_length=32)
    palette_colors: list[str] | None = Field(default=None, alias="paletteColors", max_length=12)
    palette_opacity: float | None = Field(default=None, alias="paletteOpacity", ge=0, le=1)
    series_gradient: bool | None = Field(default=None, alias="seriesGradient")
    depth_visual: Literal["off", "standard", "enhanced"] | None = Field(
        default=None, alias="depthVisual"
    )
    chart_label_show: bool | None = Field(default=None, alias="chartLabelShow")
    chart_label_style: ChartLabelStyleConfig | None = Field(
        default=None, alias="chartLabelStyle"
    )
    tooltip_show: bool | None = Field(default=None, alias="tooltipShow")
    chart_tooltip_style: ChartTooltipStyleConfig | None = Field(
        default=None, alias="chartTooltipStyle"
    )
    table_color_style: TableColorStyleConfig | None = Field(
        default=None, alias="tableColorStyle"
    )
    title_style: TitleStyleConfig | None = Field(default=None, alias="titleStyle")
    filter_chrome_style: FilterChromeStyleConfig | None = Field(
        default=None, alias="filterChromeStyle"
    )
    filter_control_style: FilterControlStyleConfig | None = Field(
        default=None, alias="filterControlStyle"
    )
    number_format: NumberFormatConfig | None = Field(default=None, alias="numberFormat")
    action_icon_color: str | None = Field(default=None, alias="actionIconColor", max_length=64)
    drill_level_colors: list[str] | None = Field(
        default=None, alias="drillLevelColors", max_length=8
    )
    dialog_style: DialogStyleConfig | None = Field(default=None, alias="dialogStyle")
    chrome: DashboardChromeConfig | None = None
    theme_variants: DashboardThemeVariants | None = Field(default=None, alias="themeVariants")
    surface_kind: Literal["dashboard", "data-screen"] | None = Field(
        default=None, alias="surfaceKind"
    )
    screen_playlist: DataScreenPlaylistConfig | None = Field(
        default=None, alias="screenPlaylist"
    )

    @model_validator(mode="after")
    def normalize_gap_fields(self) -> DashboardStyleConfig:
        preset, widget_gap, pixel_gutter = normalize_gap_config(
            gap_preset=self.gap_preset,
            widget_gap=self.widget_gap,
            pixel_gutter=self.pixel_gutter,
        )
        self.gap_preset = preset
        self.widget_gap = widget_gap
        self.pixel_gutter = pixel_gutter
        return self


class LayoutWidget(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    id: uuid.UUID
    type: WidgetType = "chart"
    title: str = Field(min_length=1, max_length=120)
    col_span: int | None = Field(default=None, ge=1, le=12, alias="colSpan")
    row_span: int | None = Field(default=None, ge=1, le=24, alias="rowSpan")
    grid_x: int | None = Field(default=None, ge=0, le=11, alias="gridX")
    grid_y: int | None = Field(default=None, ge=0, alias="gridY")
    x: int | None = Field(default=None, ge=0)
    y: int | None = Field(default=None, ge=0)
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    order: int = Field(default=0, ge=0)
    hidden: bool | None = None
    locked: bool | None = None
    chart_ref: uuid.UUID | None = Field(default=None, alias="chartRef")
    parent_tabs_id: str | None = Field(default=None, alias="parentTabsId", max_length=64)
    tab_pane_id: str | None = Field(default=None, alias="tabPaneId", max_length=64)
    chart_config: ChartViewConfigLayout | None = Field(default=None, alias="chartConfig")
    filter_config: FilterWidgetConfig | None = Field(default=None, alias="filterConfig")
    text_config: TextWidgetConfig | None = Field(default=None, alias="textConfig")
    media_config: MediaWidgetConfig | None = Field(default=None, alias="mediaConfig")
    tabs_config: TabsWidgetConfig | None = Field(default=None, alias="tabsConfig")
    custom_viz_config: CustomVizWidgetConfig | None = Field(default=None, alias="customVizConfig")
    component_ref: VizComponentRef | None = Field(default=None, alias="componentRef")

    def _is_linked_component(self) -> bool:
        return self.component_ref is not None and not bool(self.component_ref.detached)

    @model_validator(mode="after")
    def validate_type_config(self) -> LayoutWidget:
        if self._is_linked_component():
            if self.type == "tabs":
                raise ValueError("tabs widget cannot use componentRef")
            return self
        if self.type == "chart":
            if self.chart_config is None:
                raise ValueError("chart widget requires chartConfig")
            for forbidden in (self.filter_config, self.text_config, self.media_config, self.tabs_config, self.custom_viz_config):
                if forbidden is not None:
                    raise ValueError("chart widget must not carry non-chart config")
        elif self.type == "filter":
            if self.filter_config is None:
                raise ValueError("filter widget requires filterConfig")
            if self.chart_config is not None:
                raise ValueError("filter widget must not have chartConfig")
        elif self.type == "text":
            if self.text_config is None:
                raise ValueError("text widget requires textConfig")
            if self.chart_config is not None:
                raise ValueError("text widget must not have chartConfig")
        elif self.type == "media":
            if self.media_config is None:
                raise ValueError("media widget requires mediaConfig")
            if self.chart_config is not None:
                raise ValueError("media widget must not have chartConfig")
        elif self.type == "tabs":
            if self.tabs_config is None:
                raise ValueError("tabs widget requires tabsConfig")
            if self.chart_config is not None:
                raise ValueError("tabs widget must not have chartConfig")
            pane_ids = {p.id for p in self.tabs_config.panes}
            if self.tabs_config.active_pane_id not in pane_ids:
                raise ValueError("activePaneId must reference a pane id")
        elif self.type == "customViz":
            if self.custom_viz_config is None:
                raise ValueError("customViz widget requires customVizConfig")
            if self.chart_config is not None:
                raise ValueError("customViz widget must not have chartConfig")
        return self

    @model_validator(mode="before")
    @classmethod
    def default_type_chart(cls, data: Any) -> Any:
        """Old layouts omit type → treat as chart."""
        if isinstance(data, dict) and data.get("type") is None:
            data = {**data, "type": "chart"}
        return data

    @model_validator(mode="after")
    def validate_grid_bounds(self) -> LayoutWidget:
        if (
            self.grid_x is not None
            and self.col_span is not None
            and self.grid_x + self.col_span > 12
        ):
            raise ValueError("gridX + colSpan must not exceed 12")
        return self

    @staticmethod
    def is_tab_parked_child(widget: LayoutWidget) -> bool:
        return bool(widget.parent_tabs_id and widget.tab_pane_id)

    @model_validator(mode="after")
    def validate_v2_pixel_extent(self) -> LayoutWidget:
        if self.width is None and self.height is None:
            return self
        if self.is_tab_parked_child(self):
            if self.width != TAB_PARKED_PIXEL_WIDTH or self.height != TAB_PARKED_PIXEL_HEIGHT:
                raise ValueError("tab child widgets must use width=0 and height=0")
            return self
        if self.width is not None and self.width < MIN_PIXEL_WIDGET_WIDTH:
            raise ValueError(f"width must be >= {MIN_PIXEL_WIDGET_WIDTH}")
        if self.height is not None and self.height < MIN_PIXEL_WIDGET_HEIGHT:
            raise ValueError(f"height must be >= {MIN_PIXEL_WIDGET_HEIGHT}")
        return self


class DashboardCanvas(BaseModel):
    model_config = ConfigDict(extra="forbid")
    width: int = Field(default=CANVAS_WIDTH, ge=1)
    height: int = Field(default=MIN_CANVAS_HEIGHT, ge=1)


class DemoPackageMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    seed: bool = True
    source_template_key: str = Field(alias="sourceTemplateKey")


class DashboardLayout(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    version: Literal[1, 2] = 1
    canvas: DashboardCanvas | None = None
    widgets: list[LayoutWidget] = Field(default_factory=list, max_length=32)
    global_filters: list[Any] = Field(default_factory=list, alias="globalFilters", max_length=16)
    style_config: DashboardStyleConfig | None = Field(default=None, alias="styleConfig")
    demo_package: DemoPackageMeta | None = Field(default=None, alias="demoPackage")

    @model_validator(mode="before")
    @classmethod
    def validate_versioned_input(cls, data: Any) -> Any:
        if not isinstance(data, dict) or data.get("version", 1) not in (1, 2):
            return data
        version = data.get("version", 1)
        normalized = dict(data)
        normalized_widgets: list[Any] = []
        for raw_widget in data.get("widgets", []):
            if not isinstance(raw_widget, dict):
                normalized_widgets.append(raw_widget)
                continue
            widget = dict(raw_widget)
            keys = set(widget)
            forbidden = _V2_WIDGET_FIELDS if version == 1 else _V1_WIDGET_FIELDS
            mixed = sorted(keys & forbidden)
            if mixed:
                raise ValueError(
                    f"version {version} widgets must not use fields: {', '.join(mixed)}"
                )
            if version == 1:
                if not keys & {"colSpan", "col_span"}:
                    widget["colSpan"] = 6
                if not keys & {"rowSpan", "row_span"}:
                    widget["rowSpan"] = 1
            normalized_widgets.append(widget)
        normalized["widgets"] = normalized_widgets
        return normalized

    @model_validator(mode="after")
    def validate_versioned_bounds(self) -> DashboardLayout:
        if self.version == 1:
            if self.canvas is not None:
                raise ValueError("version 1 layout must not define canvas")
            return self
        if self.canvas is None:
            raise ValueError("version 2 layout requires canvas")
        surface_kind = (
            self.style_config.surface_kind
            if self.style_config and self.style_config.surface_kind
            else "dashboard"
        )
        if surface_kind == "data-screen":
            canvas = self.canvas
            if not (DATA_SCREEN_CANVAS_MIN_WIDTH <= canvas.width <= DATA_SCREEN_CANVAS_MAX_WIDTH):
                raise ValueError(
                    f"data-screen canvas width must be between "
                    f"{DATA_SCREEN_CANVAS_MIN_WIDTH} and {DATA_SCREEN_CANVAS_MAX_WIDTH}"
                )
            if not (DATA_SCREEN_CANVAS_MIN_HEIGHT <= canvas.height <= DATA_SCREEN_CANVAS_MAX_HEIGHT):
                raise ValueError(
                    f"data-screen canvas height must be between "
                    f"{DATA_SCREEN_CANVAS_MIN_HEIGHT} and {DATA_SCREEN_CANVAS_MAX_HEIGHT}"
                )
        else:
            if self.canvas.width != CANVAS_WIDTH:
                raise ValueError("dashboard canvas width must be 1440")
            if self.canvas.height < MIN_CANVAS_HEIGHT:
                raise ValueError(f"dashboard canvas height must be >= {MIN_CANVAS_HEIGHT}")
        for widget in self.widgets:
            if None in (widget.x, widget.y, widget.width, widget.height):
                raise ValueError("version 2 widgets require x, y, width and height")
            if LayoutWidget.is_tab_parked_child(widget):
                continue
            if widget.x + widget.width > self.canvas.width:
                raise ValueError("x + width must not exceed canvas width")
            if widget.y + widget.height > self.canvas.height:
                raise ValueError("y + height must not exceed canvas height")
        return self

    @model_serializer(mode="wrap")
    def serialize_versioned_layout(self, handler: Any) -> dict[str, Any]:
        data = handler(self)
        forbidden = _V2_WIDGET_FIELDS if self.version == 1 else _V1_WIDGET_FIELDS
        for widget in data["widgets"]:
            for field in forbidden:
                widget.pop(field, None)
        if self.version == 1:
            data.pop("canvas", None)
        return data

class DashboardCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=2000)


class DashboardUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class DashboardLayoutUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    layout_json: DashboardLayout = Field(alias="layoutJson")


class DashboardOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    layout_json: DashboardLayout = Field(alias="layoutJson")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class DashboardPreviewSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    version: int
    canvas: dict[str, Any] | None = None
    widgets: list[dict[str, Any]]
    style_config: dict[str, Any] | None = Field(default=None, alias="styleConfig")


class DashboardListItemOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None
    surface_kind: Literal["dashboard", "data-screen"] = Field(alias="surfaceKind")
    widget_count: int = Field(alias="widgetCount")
    layout_json: DashboardLayout = Field(alias="layoutJson")
    preview_summary: DashboardPreviewSummary = Field(alias="previewSummary")
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class DashboardListResponse(BaseModel):
    items: list[DashboardListItemOut]
    total: int
    limit: int
    offset: int
