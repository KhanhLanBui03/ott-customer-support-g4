package com.chatapp.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PageDTO<T> {
    private List<T> content;
    private int page;
    private int size;
    private long total;
    private int totalPages;
    private boolean hasNext;
    private boolean hasPrevious;

    public static <T> PageDTO<T> of(List<T> content, int page, int size, long total) {
        int totalPages = (int) Math.ceil((double) total / size);
        return PageDTO.<T>builder()
                .content(content)
                .page(page)
                .size(size)
                .total(total)
                .totalPages(totalPages)
                .hasNext(page < totalPages - 1)
                .hasPrevious(page > 0)
                .build();
    }
}
