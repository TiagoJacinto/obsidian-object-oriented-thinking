Feature: Change file path

Scenario: Changing the file path of the parent should update all nested children object hierarchy
Given the files and corresponding object hierarchies:
 | File Name | Object Hierarchy |
 | File3     | File3            |
 | File2     | File3/File2        |
 | File1     | File3/File2/File1    |
When I rename "File2" to "UpdatedFile2"
Then the object hierarchy should be:
 | File Name      | Object Hierarchy |
 | File3          | File3            |
 | UpdatedFile2   | File3/UpdatedFile2   |
 | File1          | File3/UpdatedFile2/File1   |
And "File3" should be extended by "UpdatedFile2"
And "File1" should extend "UpdatedFile2"

Scenario: Changing the file path of the parent should update all children object hierarchy
Given the files and corresponding object hierarchies:
 | File Name | Object Hierarchy  |
 | File1     | File1             |
 | File2     | File1/File2       |
 | File3     | File1/File3       |
 | File4     | File1/File4       |
When I rename "File1" to "UpdatedFile1"
Then the object hierarchy should be:
 | File Name        | Object Hierarchy    |
 | UpdatedFile1     | UpdatedFile1        |
 | File2            | UpdatedFile1/File2  |
 | File3            | UpdatedFile1/File3  |
 | File4            | UpdatedFile1/File4  |

Scenario: Changing the file path of the parent consecutively should always update children object hierarchies
Given a set of previous renames made to the parent file
		| Renames |
		| File1   |
		| File2   |
		| File3   |
		| File4   |
When the user renames the parent file
Then all the children should have updated object hierarchies
